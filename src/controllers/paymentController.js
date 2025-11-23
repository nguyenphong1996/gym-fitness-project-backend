const vnpayService = require('../services/vnpayService');
const Enrollment = require('../models/Enrollment'); // Assuming Enrollment model is relevant

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
        const result = vnpayService.vnpayReturn(req, res);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        
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
        vnpayService.vnpayIpn(req, res);
        // The vnpayService.vnpayIpn already sends the response
        // TODO: Ensure database update logic is implemented in vnpayService.vnpayIpn
    } catch (error) {
        console.error('Error handling VNPAY IPN:', error);
        next(error);
    }
};
