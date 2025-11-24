const vnpayService = require('../services/vnpayService');
const Enrollment = require('../models/Enrollment'); // Assuming Enrollment model is relevant
const PaymentTransaction = require('../models/PaymentTransaction');
const PaymentToken = require('../models/PaymentToken');

exports.createPaymentUrl = async (req, res, next) => {
    try {
        const { amount, orderInfo, bankCode } = req.body; // Frontend will send amount, orderInfo, bankCode
        if (!amount) {
            return res.status(400).json({ message: 'Amount is required' });
        }

        const vnpUrl = vnpayService.createPaymentUrl(req, amount, orderInfo, bankCode);
        res.status(200).json({ vnpUrl });
    } catch (error) {
        console.error('Error creating VNPAY URL:', error);
        next(error);
    }
};

exports.vnpayReturn = async (req, res, next) => {
    try {
        const result = await vnpayService.vnpayReturn(req);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

        // Nếu client mong muốn JSON (mobile app), trả JSON
        const acceptsJson = (req.headers.accept || '').includes('application/json');
        const isApp = req.query.platform === 'app';
        if (acceptsJson || isApp) {
            return res.status(200).json(result);
        }

        const queryParams = new URLSearchParams({
            orderId: result.orderId,
            status: result.code,
            message: result.message
        }).toString();

        // TODO: Implement actual database update logic here based on result.orderId and result.code
        if (result.code === "00") {
            // Payment success: Update enrollment status in DB
            console.log(`Payment successful for Order ID: ${result.orderId}, Amount: ${result.amount}`);
        } else {
            // Payment failed: Log or update enrollment status as failed
            console.log(`Payment failed for Order ID: ${result.orderId}, Code: ${result.code}`);
        }

        // Redirect to a dedicated frontend page to show payment status
        res.redirect(`${frontendUrl}/payment-status?${queryParams}`);

    } catch (error) {
        console.error('Error handling VNPAY return:', error);
        next(error);
    }
};

exports.vnpayIpn = async (req, res, next) => {
    try {
        await vnpayService.vnpayIpn(req, res);
    } catch (error) {
        console.error('Error handling VNPAY IPN:', error);
        next(error);
    }
};

/**
 * Tạo URL lưu thẻ (token_create) hoặc thanh toán + lưu thẻ (pay_and_create) cho VNPAY Token
 */
exports.createVnpayTokenUrl = async (req, res, next) => {
    try {
        const { amount = 0, orderInfo, cardType = '01', bankCode, mode = 'pay_and_create', userId, packageId } = req.body;
        if (!userId) {
            return res.status(400).json({ message: 'userId is required' });
        }
        if (mode !== 'token_create' && !amount) {
            return res.status(400).json({ message: 'amount is required for pay_and_create' });
        }

        const command = mode === 'token_create' ? 'token_create' : 'pay_and_create';
        const { vnpUrl, txnRef } = await vnpayService.createTokenUrl(req, {
            amount,
            orderInfo,
            userId,
            cardType,
            bankCode,
            command,
        });

        // Ghi nhận transaction (cập nhật thêm packageId nếu có)
        if (packageId) {
            await PaymentTransaction.updateOne({ txnRef }, { $set: { packageId } });
        }

        return res.status(200).json({ vnpUrl, txnRef });
    } catch (error) {
        console.error('Error creating VNPAY token URL:', error);
        return res.status(500).json({ message: error.message || 'Internal Server Error' });
    }
};

/**
 * Tạo URL thanh toán bằng token đã lưu (token_pay)
 */
exports.createVnpayTokenPayUrl = async (req, res, next) => {
    try {
        const { amount, orderInfo, token, userId, cardType = '01', bankCode, packageId } = req.body;
        if (!amount) {
            return res.status(400).json({ message: 'amount is required' });
        }
        if (!token) {
            return res.status(400).json({ message: 'token is required' });
        }
        if (!userId) {
            return res.status(400).json({ message: 'userId is required' });
        }

        const { vnpUrl, txnRef } = await vnpayService.createTokenUrl(req, {
            amount,
            orderInfo,
            userId,
            token,
            cardType,
            bankCode,
            command: 'token_pay',
        });

        if (packageId) {
            await PaymentTransaction.updateOne({ txnRef }, { $set: { packageId } });
        }

        return res.status(200).json({ vnpUrl, txnRef });
    } catch (error) {
        console.error('Error creating VNPAY token pay URL:', error);
        return res.status(500).json({ message: error.message || 'Internal Server Error' });
    }
};

/**
 * Lấy trạng thái giao dịch theo txnRef (phục vụ app polling khi dùng SDK)
 */
exports.getTransactionStatus = async (req, res, next) => {
    try {
        const { txnRef } = req.params;
        if (!txnRef) {
            return res.status(400).json({ message: 'txnRef is required' });
        }
        const tx = await PaymentTransaction.findOne({ txnRef });
        if (!tx) {
            return res.status(404).json({ message: 'Transaction not found' });
        }
        return res.status(200).json({
            txnRef: tx.txnRef,
            status: tx.status,
            responseCode: tx.responseCode,
            transactionStatus: tx.transactionStatus,
            amount: tx.amount,
            paidAt: tx.paidAt,
            channel: tx.channel,
            bankCode: tx.bankCode,
            cardType: tx.cardType,
            token: tx.token,
        });
    } catch (error) {
        console.error('Error getting transaction status:', error);
        next(error);
    }
};

/**
 * Lấy danh sách token theo userId
 */
exports.getPaymentTokens = async (req, res, next) => {
    try {
        const { userId } = req.query;
        if (!userId) {
            return res.status(400).json({ message: 'userId is required' });
        }
        const tokens = await PaymentToken.find({ userId, status: 'active' }).sort({ isDefault: -1, createdAt: -1 });
        res.status(200).json(tokens);
    } catch (error) {
        console.error('Error getting payment tokens:', error);
        next(error);
    }
};

/**
 * Xóa token theo id
 */
exports.deletePaymentToken = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ message: 'id is required' });
        }
        await PaymentToken.updateOne({ _id: id }, { $set: { status: 'disabled', isDefault: false } });
        res.status(200).json({ message: 'Deleted' });
    } catch (error) {
        console.error('Error deleting payment token:', error);
        next(error);
    }
};
