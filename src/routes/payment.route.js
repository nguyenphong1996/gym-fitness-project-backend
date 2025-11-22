const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const authMiddleware = require('../middlewares/authMiddleware');

/**
 * @swagger
 * tags:
 *   name: Payment
 *   description: Payment gateway integration
 */

/**
 * @swagger
 * /payment/create_payment_url:
 *   post:
 *     summary: Create a VNPAY payment URL
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - userId
 *               - packageId
 *             properties:
 *               amount:
 *                 type: number
 *                 description: The total amount to be paid.
 *                 example: 500000
 *               userId:
 *                 type: string
 *                 description: The ID of the user making the payment.
 *                 example: "60c72b2f9b1d8c001c8e4d1a"
 *               packageId:
 *                 type: string
 *                 description: The ID of the membership package.
 *                 example: "plus"
 *               orderInfo:
 *                 type: string
 *                 description: Additional information about the order.
 *                 example: "Thanh toan goi Plus 12 thang"
 *               bankCode:
 *                 type: string
 *                 description: The code of the bank (optional).
 *                 example: "VNBANK"
 *     responses:
 *       '200':
 *         description: Successfully created the payment URL.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 vnpUrl:
 *                   type: string
 *                   description: The full URL to redirect the user for VNPAY payment.
 *                   example: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_Amount=50000000..."
 *       '400':
 *         description: Bad request, missing required information.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Missing required payment information."
 *       '401':
 *         description: Unauthorized, invalid or missing JWT token.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Unauthorized: No token provided"
 *       '500':
 *         description: Internal server error.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Failed to create VNPAY payment URL."
 */
router.post('/create_payment_url', authMiddleware, paymentController.createPaymentUrl);

/**
 * @swagger
 * /payment/vnpay_return:
 *   get:
 *     summary: Handle the return URL from VNPAY after payment.
 *     tags: [Payment]
 *     parameters:
 *       - in: query
 *         name: vnp_Amount
 *         schema:
 *           type: string
 *         description: The amount of the transaction.
 *       - in: query
 *         name: vnp_BankCode
 *         schema:
 *           type: string
 *         description: The bank code.
 *       - in: query
 *         name: vnp_ResponseCode
 *         schema:
 *           type: string
 *         description: The response code from VNPAY ('00' for success).
 *       - in: query
 *         name: vnp_TxnRef
 *         schema:
 *           type: string
 *         description: The transaction reference from our system.
 *       - in: query
 *         name: vnp_SecureHash
 *         schema:
 *           type: string
 *         description: The secure hash to verify the request.
 *     responses:
 *       '200':
 *         description: Successfully processed the return URL. Returns the status of the transaction.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: string
 *                   example: "00"
 *                   enum: ["00", "01", "02", "04", "97", "99"]
 *                 message:
 *                   type: string
 *                   example: "Payment successful"
 *                   enum: ["Payment successful", "Order not found.", "Payment successful, awaiting confirmation.", "Invalid Amount", "Invalid Checksum.", "System error."]
 *       '400':
 *         description: Invalid parameters or amount mismatch.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: string
 *                   example: "04"
 *                 message:
 *                   type: string
 *                   example: "Invalid Amount"
 *       '404':
 *         description: Order not found in the system.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: string
 *                   example: "01"
 *                 message:
 *                   type: string
 *                   example: "Order not found."
 *       '403':
 *         description: Invalid Checksum, indicating data tampering.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: string
 *                   example: "97"
 *                 message:
 *                   type: string
 *                   example: "Invalid Checksum."
 *       '500':
 *         description: Internal server error during processing the return.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: string
 *                   example: "99"
 *                 message:
 *                   type: string
 *                   example: "System error."
 */
router.get('/vnpay_return', paymentController.vnpayReturn);

/**
 * @swagger
 * /payment/vnpay_ipn:
 *   get:
 *     summary: Handle the Instant Payment Notification (IPN) from VNPAY's server.
 *     tags: [Payment]
 *     parameters:
 *       - in: query
 *         name: vnp_Amount
 *         schema:
 *           type: string
 *         description: The amount of the transaction.
 *       - in: query
 *         name: vnp_BankCode
 *         schema:
 *           type: string
 *         description: The bank code.
 *       - in: query
 *         name: vnp_ResponseCode
 *         schema:
 *           type: string
 *         description: The response code from VNPAY ('00' for success).
 *       - in: query
 *         name: vnp_TxnRef
 *         schema:
 *           type: string
 *         description: The transaction reference from our system.
 *       - in: query
 *         name: vnp_SecureHash
 *         schema:
 *           type: string
 *         description: The secure hash to verify the request.
 *     responses:
 *       '200':
 *         description: Acknowledgment response sent back to VNPAY. Note that VNPAY expects a 200 OK with a specific JSON body for IPN, regardless of business logic outcome.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 RspCode:
 *                   type: string
 *                   example: "00"
 *                   enum: ["00", "01", "02", "04", "97", "99"]
 *                 Message:
 *                   type: string
 *                   example: "Success"
 *                   enum: ["Success", "Order not found", "Order already confirmed", "Invalid TmnCode", "Invalid Amount", "Invalid Checksum", "System error", "Payment failed."]
 *       '400':
 *         description: Invalid parameters in the IPN request.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 RspCode:
 *                   type: string
 *                   example: "04"
 *                 Message:
 *                   type: string
 *                   example: "Invalid Amount"
 *       '404':
 *         description: Order not found in the system.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 RspCode:
 *                   type: string
 *                   example: "01"
 *                 Message:
 *                   type: string
 *                   example: "Order not found"
 *       '403':
 *         description: Invalid Checksum, indicating data tampering.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 RspCode:
 *                   type: string
 *                   example: "97"
 *                 Message:
 *                   type: string
 *                   example: "Invalid Checksum"
 *       '409':
 *         description: Conflict, order already confirmed or processed.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 RspCode:
 *                   type: string
 *                   example: "02"
 *                 Message:
 *                   type: string
 *                   example: "Order already confirmed"
 *       '500':
 *         description: Internal server error during IPN processing.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 RspCode:
 *                   type: string
 *                   example: "99"
 *                 Message:
 *                   type: string
 *                   example: "System error"
 */
router.get('/vnpay_ipn', paymentController.vnpayIpn);

module.exports = router;
