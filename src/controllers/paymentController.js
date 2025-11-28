const vnpayService = require('../services/vnpayService');
const Enrollment = require('../models/Enrollment'); // Assuming Enrollment model is relevant
const PaymentTransaction = require('../models/PaymentTransaction');
const PaymentToken = require('../models/PaymentToken');
const { logInfo, logError } = require('../utils/logger');

exports.createPaymentUrl = async (req, res, next) => {
    try {
        const { amount, orderInfo, bankCode, cardType } = req.body; // Frontend will send amount, orderInfo, bankCode
        if (!amount) {
            return res.status(400).json({ message: 'Amount is required' });
        }

        const vnpUrl = vnpayService.createPaymentUrl(req, amount, orderInfo, bankCode, cardType);
        res.status(200).json({ vnpUrl });
    } catch (error) {
        console.error('Error creating VNPAY URL:', error);
        next(error);
    }
};

exports.vnpayReturn = async (req, res, next) => {
    try {
        const result = await vnpayService.vnpayReturn(req);

        // Nếu client mong muốn JSON (mobile app), trả JSON
        const acceptsJson = (req.headers.accept || '').includes('application/json');
        const isApp = req.query.platform === 'app';
        if (acceptsJson || isApp) {
            return res.status(200).json(result);
        }

        // Trả HTML đơn giản khi người dùng mở trên trình duyệt/WebView
        const isSuccess = result.code === "00";
        const html = `
<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Kết quả thanh toán</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; background: #f5f7f6; color: #10241A; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: #fff; padding: 24px; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); max-width: 360px; width: 90%; text-align: center; }
    .icon { font-size: 48px; margin-bottom: 12px; }
    .success { color: #1F8E4A; }
    .fail { color: #BA1A1A; }
    .btn { margin-top: 16px; display: inline-block; padding: 12px 16px; background: #1F8E4A; color: #fff; border-radius: 8px; text-decoration: none; font-weight: 600; }
    .btn:hover { opacity: 0.9; }
    .details { margin-top: 12px; font-size: 14px; color: #47614F; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon ${isSuccess ? 'success' : 'fail'}">${isSuccess ? '✔' : '✖'}</div>
    <h2>${isSuccess ? 'Thanh toán thành công' : 'Thanh toán thất bại'}</h2>
    <div class="details">
      <div>Mã đơn: ${result.orderId || ''}</div>
      <div>Số tiền: ${result.amount ? result.amount + ' VND' : ''}</div>
      <div>Trạng thái: ${result.message || ''}</div>
    </div>
    <button class="btn" onclick="handleReturn()">Đóng</button>
  </div>
  <script>
    function handleReturn() {
      if (document.referrer) {
        window.location.href = document.referrer;
        return;
      }
      window.close();
    }
  </script>
</body>
</html>
        `;

        return res.status(200).send(html);

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
        logInfo('paymentController.createVnpayTokenUrl', 'Tạo URL VNPAY token init', {
            userId,
            packageId,
            amount,
            command,
            cardType,
            bankCode,
        });
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

        logInfo('paymentController.createVnpayTokenUrl', 'Tạo URL thành công', { txnRef, command });
        return res.status(200).json({ vnpUrl, txnRef });
    } catch (error) {
        console.error('Error creating VNPAY token URL:', error);
        logError('paymentController.createVnpayTokenUrl', 'Lỗi tạo URL VNPAY token init', error);
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

        logInfo('paymentController.createVnpayTokenPayUrl', 'Tạo URL VNPAY token_pay', {
            userId,
            amount,
            packageId,
            cardType,
            bankCode,
            hasToken: !!token,
        });

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

        logInfo('paymentController.createVnpayTokenPayUrl', 'Tạo URL token_pay thành công', { txnRef });
        return res.status(200).json({ vnpUrl, txnRef });
    } catch (error) {
        console.error('Error creating VNPAY token pay URL:', error);
        logError('paymentController.createVnpayTokenPayUrl', 'Lỗi tạo URL token_pay', error);
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
