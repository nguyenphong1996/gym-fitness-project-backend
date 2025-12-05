const vnpayService = require('../services/vnpayService');
const membershipService = require('../services/membershipService');
const Enrollment = require('../models/Enrollment'); // Assuming Enrollment model is relevant
const PaymentTransaction = require('../models/PaymentTransaction');
const PaymentToken = require('../models/PaymentToken');
const MembershipPackage = require('../models/MembershipPackage');
const { logInfo, logError } = require('../utils/logger');

const BILLING_CYCLE_MULTIPLIERS = {
    month: 1,
    quarter: 3,
    year: 12,
};

const BILLING_CYCLE_DISCOUNTS = {
    month: 0,
    quarter: 20,
    year: 50,
};

const normalizeBillingCycle = (cycle = 'month') => {
    const c = (cycle || '').toString().toLowerCase();
    if (['quarter', 'quarterly', '3m', 'quy'].includes(c)) return 'quarter';
    if (['year', 'yearly', 'annual', '12m', 'nam'].includes(c)) return 'year';
    return 'month';
};

const computePackageAmount = async (packageId, billingCycle) => {
    const pkg = await MembershipPackage.findById(packageId);
    if (!pkg) {
        const err = new Error('Package not found');
        err.code = 'package_not_found';
        throw err;
    }

    const cycle = normalizeBillingCycle(billingCycle);
    const multiplier = BILLING_CYCLE_MULTIPLIERS[cycle] || 1;
    const discount = BILLING_CYCLE_DISCOUNTS[cycle] || 0;
    const base = pkg.price * multiplier;
    const amount = Math.round(base * (1 - discount / 100));

    return { pkg, amount, cycle };
};

exports.createPaymentUrl = async (req, res, next) => {
    try {
        const { amount, orderInfo, bankCode, cardType, packageId, billingCycle, isUpgrade = false, isTemporary = false, userId } = req.body; // Frontend will send amount, orderInfo, bankCode
        let billingCycleNorm = normalizeBillingCycle(billingCycle);
        let computedAmount = amount;
        let upgradeFromPackageId = null;
        let creditValue = 0;

        const upgradeFlag = isUpgrade || isTemporary;

        if (upgradeFlag) {
            if (!userId) {
                return res.status(400).json({ message: 'userId is required for upgrade' });
            }
            if (!packageId) {
                return res.status(400).json({ message: 'packageId is required for upgrade' });
            }
            try {
                const quote = await membershipService.calculateUpgradeQuote(userId, packageId, billingCycleNorm);
                computedAmount = quote.amountDue;
                billingCycleNorm = quote.billingCycle;
                upgradeFromPackageId = quote.upgradeFromPackageId;
                creditValue = quote.creditValue;
            } catch (err) {
                const status = err.status || 500;
                return res.status(status).json({ message: err.message || 'Failed to calculate upgrade price', error: err.code || 'server_error' });
            }
        } else if (packageId) {
            try {
                const priced = await computePackageAmount(packageId, billingCycleNorm);
                computedAmount = priced.amount;
                billingCycleNorm = priced.cycle;
            } catch (err) {
                if (err.code === 'package_not_found') {
                    return res.status(404).json({ message: 'Package not found' });
                }
                throw err;
            }
        } else if (!amount) {
            return res.status(400).json({ message: 'Amount is required' });
        }

        const { vnpUrl, txnRef } = await vnpayService.createPaymentUrl(
            req,
            computedAmount,
            orderInfo,
            bankCode,
            cardType,
            {
                userId,
                packageId,
                billingCycle: billingCycleNorm,
                isUpgrade: upgradeFlag,
                isTemporary,
                upgradeFromPackageId,
                creditValue
            }
        );
        res.status(200).json({ vnpUrl, txnRef, amount: computedAmount, billingCycle: billingCycleNorm });
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
            // Thay vì trả JSON, redirect về app với custom scheme
            // Loại bỏ các giá trị undefined/null để query string sạch hơn
            const cleanResult = {};
            Object.keys(result).forEach(key => {
                if (result[key] !== undefined && result[key] !== null) {
                    cleanResult[key] = result[key];
                }
            });
            const queryString = new URLSearchParams(cleanResult).toString();
            return res.redirect(`gymxfit://payment-result?${queryString}`);
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
        const { amount = 0, orderInfo, cardType = '01', bankCode, mode = 'pay_and_create', userId, packageId, billingCycle, isUpgrade = false, isTemporary = false } = req.body;
        if (!userId) {
            return res.status(400).json({ message: 'userId is required' });
        }

        let billingCycleNorm = normalizeBillingCycle(billingCycle);
        let computedAmount = amount;
        let upgradeFromPackageId = null;
        let creditValue = 0;

        const upgradeFlag = isUpgrade || isTemporary;

        if (upgradeFlag) {
            if (!packageId) {
                return res.status(400).json({ message: 'packageId is required for upgrade' });
            }
            try {
                const quote = await membershipService.calculateUpgradeQuote(userId, packageId, billingCycleNorm);
                computedAmount = quote.amountDue;
                billingCycleNorm = quote.billingCycle;
                upgradeFromPackageId = quote.upgradeFromPackageId;
                creditValue = quote.creditValue;
            } catch (err) {
                const status = err.status || 500;
                return res.status(status).json({ message: err.message || 'Failed to calculate upgrade price', error: err.code || 'server_error' });
            }
        } else if (packageId) {
            try {
                const priced = await computePackageAmount(packageId, billingCycleNorm);
                computedAmount = priced.amount;
                billingCycleNorm = priced.cycle;
            } catch (err) {
                if (err.code === 'package_not_found') {
                    return res.status(404).json({ message: 'Package not found' });
                }
                throw err;
            }
        } else if (mode !== 'token_create' && !amount) {
            return res.status(400).json({ message: 'amount is required for pay_and_create' });
        }

        const command = mode === 'token_create' ? 'token_create' : 'pay_and_create';
        logInfo('paymentController.createVnpayTokenUrl', 'Tạo URL VNPAY token init', {
            userId,
            packageId,
            amount: computedAmount,
            command,
            cardType,
            bankCode,
            billingCycle: billingCycleNorm,
            isUpgrade,
        });
        const { vnpUrl, txnRef } = await vnpayService.createTokenUrl(req, {
            amount: computedAmount,
            orderInfo,
            userId,
            cardType,
            bankCode,
            command,
            packageId,
            billingCycle: billingCycleNorm,
            isUpgrade: upgradeFlag,
            isTemporary,
            upgradeFromPackageId,
            creditValue,
        });

        // Ghi nhận transaction (cập nhật thêm packageId nếu có)
        if (packageId) {
            await PaymentTransaction.updateOne(
                { txnRef },
                {
                    $set: {
                        packageId,
                        billingCycle: billingCycleNorm,
                        amount: computedAmount,
                        isUpgrade: upgradeFlag,
                        isTemporary,
                        upgradeFromPackageId,
                        creditValue
                    }
                }
            );
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
        const { amount, orderInfo, token, userId, cardType = '01', bankCode, packageId, billingCycle, isUpgrade = false, isTemporary = false } = req.body;
        if (!token) {
            return res.status(400).json({ message: 'token is required' });
        }
        if (!userId) {
            return res.status(400).json({ message: 'userId is required' });
        }

        let billingCycleNorm = normalizeBillingCycle(billingCycle);
        let computedAmount = amount;
        let upgradeFromPackageId = null;
        let creditValue = 0;

        const upgradeFlag = isUpgrade || isTemporary;

        if (upgradeFlag) {
            if (!packageId) {
                return res.status(400).json({ message: 'packageId is required for upgrade' });
            }
            try {
                const quote = await membershipService.calculateUpgradeQuote(userId, packageId, billingCycleNorm);
                computedAmount = quote.amountDue;
                billingCycleNorm = quote.billingCycle;
                upgradeFromPackageId = quote.upgradeFromPackageId;
                creditValue = quote.creditValue;
            } catch (err) {
                const status = err.status || 500;
                return res.status(status).json({ message: err.message || 'Failed to calculate upgrade price', error: err.code || 'server_error' });
            }
        } else if (packageId) {
            try {
                const priced = await computePackageAmount(packageId, billingCycleNorm);
                computedAmount = priced.amount;
                billingCycleNorm = priced.cycle;
            } catch (err) {
                if (err.code === 'package_not_found') {
                    return res.status(404).json({ message: 'Package not found' });
                }
                throw err;
            }
        } else if (!amount) {
            return res.status(400).json({ message: 'amount is required' });
        }

        logInfo('paymentController.createVnpayTokenPayUrl', 'Tạo URL VNPAY token_pay', {
            userId,
            amount: computedAmount,
            packageId,
            cardType,
            bankCode,
            billingCycle: billingCycleNorm,
            hasToken: !!token,
            isUpgrade: upgradeFlag,
            isTemporary,
        });

        const { vnpUrl, txnRef } = await vnpayService.createTokenUrl(req, {
            amount: computedAmount,
            orderInfo,
            userId,
            token,
            cardType,
            bankCode,
            command: 'token_pay',
            packageId,
            billingCycle: billingCycleNorm,
            isUpgrade: upgradeFlag,
            isTemporary,
            upgradeFromPackageId,
            creditValue,
        });

        if (packageId) {
            await PaymentTransaction.updateOne(
                { txnRef },
                {
                    $set: {
                        packageId,
                        billingCycle: billingCycleNorm,
                        amount: computedAmount,
                        isUpgrade: upgradeFlag,
                        isTemporary,
                        upgradeFromPackageId,
                        creditValue
                    }
                }
            );
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
