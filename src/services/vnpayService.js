const moment = require('moment');
const querystring = require('qs');
const crypto = require("crypto");
const axios = require('axios');
const PaymentTransaction = require('../models/PaymentTransaction');
const PaymentToken = require('../models/PaymentToken');
const appendPlatformParam = (url) => {
    if (!url) return url;
    const hasQuery = url.includes('?');
    const joiner = hasQuery ? '&' : '?';
    return `${url}${joiner}platform=app`;
};

function sortObject(obj) {
    let sorted = {};
    let str = [];
    let key;
    for (key in obj){
        if (obj.hasOwnProperty(key)) {
            str.push(encodeURIComponent(key));
        }
    }
    str.sort();
    for (key = 0; key < str.length; key++) {
        sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, "+");
    }
    return sorted;
}

const normalizeField = (obj, keys) => {
    for (const key of keys) {
        if (obj[key] !== undefined) {
            return obj[key];
        }
    }
    return undefined;
};

const normalizeSecureHash = (obj) => normalizeField(obj, ['vnp_SecureHash', 'vnp_secure_hash']);

const normalizeCommand = (obj) => normalizeField(obj, ['vnp_Command', 'vnp_command']) || '';

const normalizeTxnRef = (obj) => normalizeField(obj, ['vnp_TxnRef', 'vnp_txn_ref']) || '';

const normalizeAmount = (obj) => {
    const amt = normalizeField(obj, ['vnp_Amount', 'vnp_amount']);
    if (amt === undefined) return undefined;
    const num = Number(amt);
    return Number.isFinite(num) ? num : undefined;
};

const withSignedParams = (params, secretKey) => {
    const sorted = sortObject(params);
    const signData = querystring.stringify(sorted, { encode: false });
    const hmac = crypto.createHmac("sha512", secretKey);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");
    return { sorted, secureHash: signed };
};

const buildTxnRef = () => moment().format('DDHHmmss');

const getClientIp = (req) => {
    return req.headers['x-forwarded-for'] ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        req.connection?.socket?.remoteAddress ||
        '0.0.0.0';
};

exports.createPaymentUrl = (req, amount, orderInfo, bankCode, cardType) => {
    process.env.TZ = 'Asia/Ho_Chi_Minh';
    
    let date = new Date();
    let createDate = moment(date).format('YYYYMMDDHHmmss');
    let orderId = moment(date).format('DDHHmmss');

    let ipAddr = req.headers['x-forwarded-for'] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.connection.socket.remoteAddress;

    let tmnCode = process.env.VNP_TMNCODE;
    let secretKey = process.env.VNP_HASHSECRET;
    let vnpUrl = process.env.VNP_URL;
    let returnUrl = appendPlatformParam(process.env.VNP_RETURNURL);
    let vnpVersion = process.env.VNP_VERSION;
    
    let locale = 'vn'; // Assuming default locale is 'vn'
    let currCode = 'VND';
    let vnp_Params = {};
    vnp_Params['vnp_Version'] = vnpVersion;
    vnp_Params['vnp_Command'] = 'pay';
    vnp_Params['vnp_TmnCode'] = tmnCode;
    vnp_Params['vnp_Locale'] = locale;
    vnp_Params['vnp_CurrCode'] = currCode;
    vnp_Params['vnp_TxnRef'] = orderId;
    vnp_Params['vnp_OrderInfo'] = orderInfo || ('Thanh toan cho ma GD:' + orderId);
    vnp_Params['vnp_OrderType'] = 'other';
    vnp_Params['vnp_Amount'] = amount * 100;
    vnp_Params['vnp_ReturnUrl'] = returnUrl;
    vnp_Params['vnp_IpAddr'] = ipAddr;
    vnp_Params['vnp_CreateDate'] = createDate;
    if(bankCode !== null && bankCode !== ''){
        vnp_Params['vnp_BankCode'] = bankCode;
    }
    if(cardType){
        vnp_Params['vnp_CardType'] = cardType; // 01 nội địa, 02 quốc tế
    }

    vnp_Params = sortObject(vnp_Params);

    let signData = querystring.stringify(vnp_Params, { encode: false });
    let hmac = crypto.createHmac("sha512", secretKey);
    let signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex"); 
    vnp_Params['vnp_SecureHash'] = signed;
    vnpUrl += '?' + querystring.stringify(vnp_Params, { encode: false });

    return vnpUrl;
};

exports.vnpayReturn = async (req) => {
    const verification = exports.verifyVnpayParams(req.query);
    if (!verification.isValid) {
        return { code: "97", message: "Checksum failed" };
    }

    const { rspCode, transactionStatus, txnRef, params, amount } = verification;
    const isSuccess = rspCode === '00' && transactionStatus === '00';
    await exports.updateTransactionStatus({ txnRef, rspCode, transactionStatus, params, source: 'return' });

    return {
        code: rspCode,
        message: isSuccess ? "Success" : "Failed",
        orderId: txnRef,
        amount: amount ? amount / 100 : undefined,
    };
};

/**
 * Tạo URL thanh toán/token cho luồng token VNPAY
 * command: 'token_create' | 'pay_and_create' | 'token_pay'
 */
exports.createTokenUrl = async (req, {
    amount,
    orderInfo,
    userId,
    token,
    cardType = '01',
    bankCode,
    command = 'pay_and_create',
    storeToken = 1,
}) => {
    process.env.TZ = 'Asia/Ho_Chi_Minh';
    const date = new Date();
    const createDate = moment(date).format('YYYYMMDDHHmmss');
    const txnRef = buildTxnRef();
    const ipAddr = getClientIp(req);

    const tmnCode = process.env.VNP_TMNCODE;
    const secretKey = process.env.VNP_HASHSECRET;
    const vnpVersion = process.env.VNP_VERSION || '2.1.0';
    const baseReturnUrl = appendPlatformParam(process.env.VNP_RETURNURL || process.env.VNP_TOKEN_RETURNURL || '');
    const tokenCreateUrl = process.env.VNP_TOKEN_CREATE_URL || 'https://sandbox.vnpayment.vn/token_ui/create-token.html';
    const payAndCreateUrl = process.env.VNP_TOKEN_PAY_CREATE_URL || 'https://sandbox.vnpayment.vn/token_ui/pay-create-token.html';
    const tokenPayUrl = process.env.VNP_TOKEN_PAY_URL || 'https://sandbox.vnpayment.vn/token_ui/payment-token.html';
    const targetUrl = command === 'token_create' ? tokenCreateUrl : (command === 'token_pay' ? tokenPayUrl : payAndCreateUrl);

    if (!tmnCode || !secretKey) {
        throw new Error('Thiếu cấu hình VNPAY: VNP_TMNCODE hoặc VNP_HASHSECRET');
    }
    if (!baseReturnUrl) {
        throw new Error('Thiếu cấu hình VNP_RETURNURL/VNP_TOKEN_RETURNURL');
    }

    const params = {
        vnp_version: vnpVersion,
        vnp_command: command,
        vnp_tmn_code: tmnCode,
        vnp_app_user_id: userId,
        vnp_txn_ref: txnRef,
        vnp_txn_desc: orderInfo || `Thanh toan va luu the ${txnRef}`,
        vnp_ip_addr: ipAddr,
        vnp_create_date: createDate,
        vnp_locale: 'vi',
        vnp_return_url: baseReturnUrl,
        vnp_cancel_url: baseReturnUrl,
    };

    if (cardType) {
        params['vnp_card_type'] = cardType; // 01 noi dia, 02 quoc te
    }

    if (bankCode) {
        params['vnp_bank_code'] = bankCode;
    }

    // Với token_pay và pay_and_create cần số tiền
    if (command !== 'token_create') {
        params['vnp_amount'] = Math.round((amount || 0) * 100); // VNPAY yêu cầu nhân 100
        params['vnp_curr_code'] = 'VND';
    }

    if (command === 'token_pay') {
        params['vnp_token'] = token;
    }

    if (command === 'pay_and_create') {
        params['vnp_store_token'] = storeToken ? 1 : 0;
    }

    const { sorted, secureHash } = withSignedParams(params, secretKey);
    sorted['vnp_secure_hash'] = secureHash;

    const url = targetUrl + '?' + querystring.stringify(sorted, { encode: false });

    // Lưu log pending (không làm hỏng flow nếu DB lỗi)
    try {
        await PaymentTransaction.create({
            txnRef,
            channel: command === 'token_pay' ? 'vnpay_token_pay' : (command === 'token_create' ? 'vnpay_token_create' : 'vnpay_pay_and_create'),
            userId,
            amount: amount || 0,
            orderInfo,
            status: 'pending',
        });
    } catch (err) {
        console.error('Không lưu được PaymentTransaction:', err.message);
    }

    return { vnpUrl: url, txnRef };
};

/**
 * Xác thực checksum + map dữ liệu trả về từ VNPAY (return/IPN)
 */
exports.verifyVnpayParams = (vnpParamsRaw) => {
    const vnp_Params = {};
    // Chỉ giữ lại các tham số bắt đầu bằng vnp_ để tránh key ngoài (ví dụ platform) làm sai checksum
    Object.keys(vnpParamsRaw || {}).forEach((key) => {
        if (key.toLowerCase().startsWith('vnp_')) {
            vnp_Params[key] = vnpParamsRaw[key];
        }
    });

    const secureHash = normalizeSecureHash(vnp_Params);
    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_secure_hash'];
    delete vnp_Params['vnp_SecureHashType'];
    delete vnp_Params['vnp_secure_hash_type'];

    const secretKey = process.env.VNP_HASHSECRET;
    const { secureHash: expectedHash } = withSignedParams(vnp_Params, secretKey);
    const isValid = secureHash === expectedHash;

    const rspCode = normalizeField(vnp_Params, ['vnp_ResponseCode', 'vnp_response_code']);
    const transactionStatus = normalizeField(vnp_Params, ['vnp_TransactionStatus', 'vnp_transaction_status']);
    const txnRef = normalizeTxnRef(vnp_Params);
    const amount = normalizeAmount(vnp_Params);

    return {
        isValid,
        rspCode,
        transactionStatus,
        txnRef,
        amount,
        params: vnp_Params,
    };
};

const savePaymentTokenIfAny = async (params) => {
    try {
        const token = normalizeField(params, ['vnp_token', 'vnp_Token']);
        const cardMask = normalizeField(params, ['vnp_card_number', 'vnp_CardNumber']);
        const cardType = normalizeField(params, ['vnp_card_type', 'vnp_CardType']);
        const bankCode = normalizeField(params, ['vnp_bank_code', 'vnp_BankCode']);
        const tmnCode = normalizeField(params, ['vnp_tmn_code', 'vnp_TmnCode']) || process.env.VNP_TMNCODE;
        const appUserId = normalizeField(params, ['vnp_app_user_id', 'vnp_App_User_Id']);
        const command = normalizeField(params, ['vnp_command', 'vnp_Command']);

        if (!token || !appUserId) {
            return;
        }

        // Chỉ lưu token khi command là token_create hoặc pay_and_create
        if (command !== 'token_create' && command !== 'pay_and_create') {
            return;
        }

        // Reset isDefault=true cho token đầu tiên của user
        const existing = await PaymentToken.findOne({ userId: appUserId, status: 'active' });
        const isDefault = !existing;

        await PaymentToken.findOneAndUpdate(
            { userId: appUserId, token },
            {
                userId: appUserId,
                token,
                cardMask,
                cardType,
                bankCode,
                tmnCode,
                status: 'active',
                isDefault,
            },
            { upsert: true, new: true }
        );
    } catch (err) {
        console.error('Không lưu được PaymentToken:', err.message);
    }
};

/**
 * Cập nhật trạng thái giao dịch sau khi xác thực VNPAY
 */
exports.updateTransactionStatus = async ({ txnRef, rspCode, transactionStatus, params, source = 'return' }) => {
    if (!txnRef) return null;
    const tx = await PaymentTransaction.findOne({ txnRef });
    if (!tx) return null;

    const isSuccess = rspCode === '00' && transactionStatus === '00';
    const nextStatus = isSuccess ? 'paid' : 'failed';

    // Chỉ cập nhật nếu chưa paid
    if (tx.status !== 'paid') {
        tx.status = nextStatus;
        tx.responseCode = rspCode;
        tx.transactionStatus = transactionStatus;
        tx.vnpTransactionNo = normalizeField(params, ['vnp_TransactionNo', 'vnp_transaction_no']) || tx.vnpTransactionNo;
        tx.bankCode = normalizeField(params, ['vnp_BankCode', 'vnp_bank_code']) || tx.bankCode;
        tx.cardType = normalizeField(params, ['vnp_card_type', 'vnp_CardType']) || tx.cardType;
        tx.token = normalizeField(params, ['vnp_token', 'vnp_Token']) || tx.token;
        tx.paidAt = isSuccess ? (tx.paidAt || new Date()) : tx.paidAt;
    }

    if (source === 'ipn') {
        tx.rawIpnParams = params;
    } else {
        tx.rawReturnParams = params;
    }

    await tx.save();

    // Lưu token nếu có trong params và giao dịch thành công
    if (isSuccess) {
        await savePaymentTokenIfAny(params);
    }

    return tx;
};

/**
 * QueryDR tới VNPAY để chốt trạng thái
 */
exports.queryDr = async ({ txnRef, transactionDate }) => {
    const url = process.env.VNP_QUERY_URL || 'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction';
    const requestId = `${moment().format('YYYYMMDDHHmmss')}-${Math.floor(Math.random() * 1000)}`;
    const createDate = moment().format('YYYYMMDDHHmmss');
    const tmnCode = process.env.VNP_TMNCODE;
    const secretKey = process.env.VNP_HASHSECRET;
    const version = process.env.VNP_VERSION || '2.1.0';
    const ipAddr = '0.0.0.0';

    const payload = {
        vnp_RequestId: requestId,
        vnp_Version: version,
        vnp_Command: 'querydr',
        vnp_TmnCode: tmnCode,
        vnp_TxnRef: txnRef,
        vnp_OrderInfo: `Query transaction ${txnRef}`,
        vnp_TransactionDate: transactionDate || moment().format('YYYYMMDDHHmmss'),
        vnp_CreateDate: createDate,
        vnp_IpAddr: ipAddr,
    };

    const data = `${payload.vnp_RequestId}|${payload.vnp_Version}|${payload.vnp_Command}|${payload.vnp_TmnCode}|${payload.vnp_TxnRef}|${payload.vnp_TransactionDate}|${payload.vnp_CreateDate}|${payload.vnp_IpAddr}|${payload.vnp_OrderInfo}`;
    const checksum = crypto.createHmac('sha512', secretKey).update(data).digest('hex');
    payload.vnp_SecureHash = checksum;

    const response = await axios.post(url, payload, { headers: { 'Content-Type': 'application/json' }, timeout: 15000 });
    return response.data;
};

exports.vnpayIpn = async (req, res) => {
    try {
        const verification = exports.verifyVnpayParams(req.query);
        if (!verification.isValid) {
            return res.status(200).json({ RspCode: '97', Message: 'Checksum failed' });
        }

        const { rspCode, transactionStatus, txnRef, amount, params } = verification;
        if (!txnRef) {
            return res.status(200).json({ RspCode: '01', Message: 'Order not found' });
        }

        // Cập nhật giao dịch
        const updated = await exports.updateTransactionStatus({ txnRef, rspCode, transactionStatus, params, source: 'ipn' });
        if (!updated) {
            return res.status(200).json({ RspCode: '01', Message: 'Order not found' });
        }

        // (Tuỳ chọn) kiểm tra amount khớp
        if (amount && updated.amount && Math.round(updated.amount * 100) !== amount) {
            return res.status(200).json({ RspCode: '04', Message: 'Amount invalid' });
        }

        // (Tuỳ chọn) QueryDR để chốt trạng thái
        try {
            const queryResult = await exports.queryDr({ txnRef, transactionDate: params?.vnp_CreateDate });
            const isOk = queryResult?.vnp_ResponseCode === '00' && queryResult?.vnp_TransactionStatus === '00';
            if (isOk && updated.status !== 'paid') {
                await exports.updateTransactionStatus({
                    txnRef,
                    rspCode: queryResult.vnp_ResponseCode,
                    transactionStatus: queryResult.vnp_TransactionStatus,
                    params: queryResult,
                    source: 'ipn',
                });
            }
        } catch (err) {
            console.error('QueryDR failed (sandbox may be unreachable):', err.message);
        }

        return res.status(200).json({ RspCode: '00', Message: 'Success' });
    } catch (error) {
        console.error('Error in vnpayIpn:', error);
        return res.status(500).json({ RspCode: '99', Message: 'Internal error' });
    }
};
