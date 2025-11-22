// payment.controller.js
const paymentService = require('../services/payment.service');

// Controller logic for handling payment-related requests
exports.createPaymentUrl = async (req, res) => {
    try {
        const { amount, userId, packageId, orderInfo, bankCode, locale } = req.body;
        const ipAddr = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

        if (!amount || !userId || !packageId) {
            return res.status(400).json({ message: 'Missing required payment information.' });
        }

        const vnpUrl = await paymentService.createPaymentUrl(
            amount,
            userId,
            packageId,
            orderInfo,
            bankCode,
            locale,
            ipAddr
        );
        res.status(200).json({ vnpUrl });
    } catch (error) {
        console.error('Error in createPaymentUrl controller:', error);
        res.status(500).json({ message: 'Failed to create VNPAY payment URL.' });
    }
};

exports.vnpayReturn = async (req, res) => {
    try {
        const result = await paymentService.vnpayReturn(req.query);
        // Depending on frontend needs, you might redirect or render a view
        // For an API context, we send JSON response
        res.status(200).json(result);
    } catch (error) {
        console.error('Error in vnpayReturn controller:', error);
        res.status(500).json({ code: '99', message: 'Internal Server Error' });
    }
};

exports.vnpayIpn = async (req, res) => {
    try {
        // VNPAY often sends IPN via GET with query parameters
        const result = await paymentService.vnpayIpn(req.query);
        // VNPAY expects a specific JSON response
        res.status(200).json(result);
    } catch (error) {
        console.error('Error in vnpayIpn controller:', error);
        res.status(500).json({ RspCode: '99', Message: 'Internal Server Error' });
    }
};
