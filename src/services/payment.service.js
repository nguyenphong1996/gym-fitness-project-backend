// payment.service.js
const moment = require('moment');
const crypto = require('crypto');
const querystring = require('qs');
const Transaction = require('../models/Transaction');
const { v4: uuidv4 } = require('uuid');

// Load VNPAY configuration from environment variables
const vnp_TmnCode = process.env.VNP_TMNCODE;
const vnp_HashSecret = process.env.VNP_HASHSECRET;
const vnp_Url = process.env.VNP_URL;
const vnp_ReturnUrl = process.env.VNP_RETURNURL;
const vnp_Api = process.env.VNP_API;
const vnp_Version = process.env.VNP_VERSION;


exports.createPaymentUrl = async (amount, userId, packageId, orderInfo, bankCode, locale, ipAddr) => {
    try {
        const orderId = uuidv4(); // Generate a unique order ID for our system

        // Create a pending transaction record in our database
        const newTransaction = new Transaction({
            userId,
            packageId,
            amount,
            orderId: orderId,
            transactionStatus: 'pending',
            paymentMethod: 'VNPAY',
            transactionDescription: orderInfo,
        });
        await newTransaction.save();

        const vnp_Params = {};
        vnp_Params['vnp_Version'] = vnp_Version;
        vnp_Params['vnp_Command'] = 'pay';
        vnp_Params['vnp_TmnCode'] = vnp_TmnCode;
        vnp_Params['vnp_Locale'] = locale || 'vn'; // 'vn' for Vietnamese, 'en' for English
        vnp_Params['vnp_CurrCode'] = 'VND';
        vnp_Params['vnp_TxnRef'] = orderId; // Our internal order ID
        vnp_Params['vnp_OrderInfo'] = orderInfo || `Thanh toan don hang ${orderId}`;
        vnp_Params['vnp_OrderType'] = 'billpayment'; // Or specific type like 'fashion', 'other'
        vnp_Params['vnp_Amount'] = amount * 100; // VNPAY requires amount in cents/smallest unit
        vnp_Params['vnp_ReturnUrl'] = vnp_ReturnUrl;
        vnp_Params['vnp_IpAddr'] = ipAddr;
        vnp_Params['vnp_CreateDate'] = moment().format('YYYYMMDDHHmmss');
        if (bankCode) {
            vnp_Params['vnp_BankCode'] = bankCode;
        }

        // Sort parameters alphabetically
        const sortedParams = Object.keys(vnp_Params).sort().reduce((obj, key) => {
            obj[key] = vnp_Params[key];
            return obj;
        }, {});

        const signData = querystring.stringify(sortedParams, { encode: false });
        const hmac = crypto.createHmac('sha512', vnp_HashSecret); // Use sha512 as per VNPAY docs
        const vnp_SecureHash = hmac.update(signData).digest('hex');

        // Append secure hash to params
        sortedParams['vnp_SecureHash'] = vnp_SecureHash;

        return vnp_Url + '?' + querystring.stringify(sortedParams, { encode: true });

    } catch (error) {
        console.error('Error creating VNPAY payment URL:', error);
        return { RspCode: '99', Message: 'System error' };
    }
};

exports.vnpayReturn = async (vnp_Params) => {
    try {
        let secureHash = vnp_Params['vnp_SecureHash'];
        let orderId = vnp_Params['vnp_TxnRef'];
        let responseCode = vnp_Params['vnp_ResponseCode'];
        let amount = vnp_Params['vnp_Amount'];

        delete vnp_Params['vnp_SecureHash'];
        delete vnp_Params['vnp_SecureHashType'];

        const sortedParams = Object.keys(vnp_Params).sort().reduce((obj, key) => {
            obj[key] = vnp_Params[key];
            return obj;
        }, {});

        const signData = querystring.stringify(sortedParams, { encode: false });
        const hmac = crypto.createHmac('sha512', vnp_HashSecret);
        const signed = hmac.update(signData).digest('hex');

        if (secureHash === signed) {
            // Find the transaction in our database
            const transaction = await Transaction.findOne({ orderId: orderId });

            if (transaction) {
                // Check if the amount matches to prevent tampering
                if (transaction.amount * 100 !== parseInt(amount)) {
                    return { code: '04', message: 'Invalid Amount' };
                }

                // Return status based on VNPAY's response code and our internal transaction status
                if (responseCode === '00' && transaction.transactionStatus === 'success') {
                    return { code: '00', message: 'Payment successful' };
                } else if (responseCode === '00' && transaction.transactionStatus === 'pending') {
                    // This scenario means IPN has not yet updated the status.
                    // Frontend can poll our API or user can retry verification later.
                    return { code: '02', message: 'Payment successful, awaiting confirmation.' };
                }
                 else {
                    return { code: '01', message: 'Payment failed or pending.' };
                }
            } else {
                return { code: '01', message: 'Order not found.' };
            }
        } else {
            return { code: '97', message: 'Invalid Checksum.' };
        }
    } catch (error) {
        console.error('Error handling VNPAY return:', error);
        return { code: '99', message: 'System error.' };
    }
};

exports.vnpayIpn = async (vnp_Params) => {
    try {
        let secureHash = vnp_Params['vnp_SecureHash'];
        let tmnCode = vnp_Params['vnp_TmnCode'];
        let orderId = vnp_Params['vnp_TxnRef'];
        let responseCode = vnp_Params['vnp_ResponseCode'];
        let vnp_Amount = vnp_Params['vnp_Amount'];
        let vnp_TransactionNo = vnp_Params['vnp_TransactionNo'];
        let bankCode = vnp_Params['vnp_BankCode'];
        let cardType = vnp_Params['vnp_CardType'];
        let payDate = vnp_Params['vnp_PayDate'];

        delete vnp_Params['vnp_SecureHash'];
        delete vnp_Params['vnp_SecureHashType'];

        const sortedParams = Object.keys(vnp_Params).sort().reduce((obj, key) => {
            obj[key] = vnp_Params[key];
            return obj;
        }, {});

        const signData = querystring.stringify(sortedParams, { encode: false });
        const hmac = crypto.createHmac('sha512', vnp_HashSecret);
        const signed = hmac.update(signData).digest('hex');

        let rspCode = '99'; // Default error code
        let message = 'Unknown error';

        if (secureHash === signed) {
            const transaction = await Transaction.findOne({ orderId: orderId });

            if (transaction) {
                if (tmnCode !== vnp_TmnCode) { // Check if TmnCode matches configured TmnCode
                    rspCode = '04';
                    message = 'Invalid TmnCode';
                } else if (transaction.amount * 100 !== parseInt(vnp_Amount)) { // Check if amount matches
                    rspCode = '04';
                    message = 'Invalid Amount';
                } else if (transaction.transactionStatus === 'success') { // Already processed
                    rspCode = '02';
                    message = 'Order already confirmed';
                } else {
                    if (responseCode === '00') {
                        // Payment successful
                        transaction.transactionStatus = 'success';
                        // TODO: Implement membership activation logic here
                        // For example: await userService.activateMembership(transaction.userId, transaction.packageId, transaction.payDate, transaction.amount);
                        message = 'Payment successful, membership activated.';
                        rspCode = '00';
                    } else {
                        // Payment failed
                        transaction.transactionStatus = 'failed';
                        message = 'Payment failed.';
                        rspCode = '00'; // Still return 00 to VNPAY to acknowledge receipt
                    }

                    transaction.vnpTransactionNo = vnp_TransactionNo;
                    transaction.bankCode = bankCode;
                    transaction.cardType = cardType;
                    transaction.payDate = moment(payDate, 'YYYYMMDDHHmmss').toDate();
                    transaction.responseCode = responseCode;

                    await transaction.save();
                }
            } else {
                rspCode = '01';
                message = 'Order not found';
            }
        } else {
            rspCode = '97';
            message = 'Invalid Checksum';
        }

        return { RspCode: rspCode, Message: message };

    } catch (error) {
        console.error('Error handling VNPAY IPN:', error);
        return { RspCode: '99', Message: 'System error' };
    }
};
