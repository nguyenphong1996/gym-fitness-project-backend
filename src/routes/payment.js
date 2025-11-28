const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

/**
 * @swagger
 * tags:
 *   name: Payment
 *   description: API tích hợp thanh toán VNPAY
 */

/**
 * @swagger
 * /api/v1/payment/create-payment-url:
 *   post:
 *     summary: Tạo URL thanh toán VNPAY
 *     description: Nhận thông tin đơn hàng và tạo một URL để chuyển hướng người dùng đến cổng thanh toán VNPAY.
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
 *               - orderInfo
 *             properties:
 *               amount:
 *                 type: number
 *                 description: "Tổng số tiền thanh toán (bắt buộc)."
 *                 example: 1800000
 *               orderInfo:
 *                 type: string
 *                 description: "Thông tin mô tả đơn hàng (bắt buộc)."
 *                 example: "Thanh toan goi hoi vien Premium 12 thang"
 *               bankCode:
 *                 type: string
 *                 description: "Mã ngân hàng. Nếu không có, VNPAY sẽ hiển thị danh sách ngân hàng để người dùng chọn."
 *                 example: "NCB"
 *               cardType:
 *                 type: string
 *                 description: "Loại thẻ: 01 (nội địa), 02 (quốc tế)."
 *                 example: "02"
 *     responses:
 *       200:
 *         description: Trả về URL thanh toán VNPAY.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 vnpUrl:
 *                   type: string
 *                   format: uri
 *                   example: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_Amount=180000000&..."
 *       400:
 *         description: "Dữ liệu đầu vào không hợp lệ (ví dụ: thiếu `amount`)."
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Amount is required"
 *       500:
 *         description: Lỗi máy chủ khi tạo URL.
 */
router.post('/create-payment-url', paymentController.createPaymentUrl);

/**
 * @swagger
 * /api/v1/payment/vnpay-return:
 *   get:
 *     summary: Xử lý kết quả VNPAY trả về
 *     description: |
 *       Endpoint để VNPAY chuyển hướng người dùng trở lại sau khi hoàn tất thanh toán.
 *       API sẽ xác thực chữ ký, cập nhật trạng thái đơn hàng và trả kết quả JSON hoặc trang HTML thông báo trạng thái.
 *       **Lưu ý:** Người dùng không gọi trực tiếp API này.
 *     tags: [Payment]
 *     parameters:
 *       - in: query
 *         name: vnp_Amount
 *         schema: { type: string }
 *         description: Số tiền giao dịch.
 *       - in: query
 *         name: vnp_BankCode
 *         schema: { type: string }
 *         description: Mã ngân hàng.
 *       - in: query
 *         name: vnp_ResponseCode
 *         schema: { type: string }
 *         description: "Mã phản hồi từ VNPAY (`00` = thành công)."
 *       - in: query
 *         name: vnp_TxnRef
 *         schema: { type: string }
 *         description: Mã tham chiếu của giao dịch.
 *       - in: query
 *         name: vnp_SecureHash
 *         schema: { type: string }
 *         description: Chữ ký bảo mật để xác thực.
 *     responses:
 *       200:
 *         description: Kết quả thanh toán (JSON hoặc trang HTML hiển thị trạng thái).
 *       500:
 *         description: Lỗi máy chủ hoặc xác thực chữ ký thất bại.
 */
router.get('/vnpay-return', paymentController.vnpayReturn);

/**
 * @swagger
 * /api/v1/payment/vnpay-ipn:
 *   get:
 *     summary: Xử lý thông báo IPN từ VNPAY
 *     description: |
 *       Endpoint để VNPAY gửi thông báo kết quả giao dịch ngầm (server-to-server).
 *       Đây là phương thức xác nhận thanh toán đáng tin cậy nhất.
 *       API sẽ xác thực và cập nhật trạng thái đơn hàng trong cơ sở dữ liệu.
 *       **Lưu ý:** Người dùng không gọi trực tiếp API này.
 *     tags: [Payment]
 *     parameters:
 *       - in: query
 *         name: vnp_Amount
 *         schema: { type: string }
 *       - in: query
 *         name: vnp_BankCode
 *         schema: { type: string }
 *       - in: query
 *         name: vnp_ResponseCode
 *         schema: { type: string }
 *       - in: query
 *         name: vnp_TxnRef
 *         schema: { type: string }
 *       - in: query
 *         name: vnp_SecureHash
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Phản hồi cho VNPAY biết đã nhận và xử lý thành công/thất bại.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 RspCode:
 *                   type: string
 *                   example: "00"
 *                 Message:
 *                   type: string
 *                   example: "Success"
 */
router.get('/vnpay-ipn', paymentController.vnpayIpn);

/**
 * @swagger
 * /api/v1/payment/token/init:
 *   post:
 *     summary: Tạo URL lưu thẻ hoặc thanh toán + lưu thẻ (VNPAY Token)
 *     tags: [Payment]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId: { type: string }
 *               amount: { type: number, description: "Bắt buộc nếu mode=pay_and_create" }
 *               orderInfo: { type: string }
 *               cardType: { type: string, example: "01", description: "01 (nội địa), 02 (quốc tế)" }
 *               bankCode: { type: string }
 *               mode: { type: string, enum: ["token_create", "pay_and_create"], default: "pay_and_create" }
 *               packageId: { type: string }
 *     responses:
 *       200:
 *         description: URL VNPAY token
 */
router.post('/token/init', paymentController.createVnpayTokenUrl);

/**
 * @swagger
 * /api/v1/payment/token/pay:
 *   post:
 *     summary: Tạo URL thanh toán bằng token đã lưu (VNPAY Token Pay)
 *     tags: [Payment]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId: { type: string }
 *               amount: { type: number }
 *               orderInfo: { type: string }
 *               token: { type: string }
 *               cardType: { type: string, example: "01", description: "01 (nội địa), 02 (quốc tế)" }
 *               bankCode: { type: string }
 *               packageId: { type: string }
 *     responses:
 *       200:
 *         description: URL VNPAY token pay
 */
router.post('/token/pay', paymentController.createVnpayTokenPayUrl);

// App dùng để polling trạng thái giao dịch theo txnRef (phục vụ SDK)
/**
 * @swagger
 * /api/v1/payment/transaction/{txnRef}:
 *   get:
 *     summary: Lấy trạng thái giao dịch VNPAY theo txnRef
 *     tags: [Payment]
 *     parameters:
 *       - in: path
 *         name: txnRef
 *         required: true
 *         schema: { type: string }
 *         description: Mã tham chiếu giao dịch (vnp_TxnRef)
 *     responses:
 *       200:
 *         description: Thông tin trạng thái giao dịch
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 txnRef: { type: string }
 *                 status: { type: string, enum: ["pending","paid","failed"] }
 *                 responseCode: { type: string, nullable: true }
 *                 transactionStatus: { type: string, nullable: true }
 *                 amount: { type: number }
 *                 paidAt: { type: string, format: date-time, nullable: true }
 *                 channel: { type: string }
 *       404:
 *         description: Transaction not found
 */
router.get('/transaction/:txnRef', paymentController.getTransactionStatus);

// Danh sách/xóa token
/**
 * @swagger
 * /api/v1/payment/tokens:
 *   get:
 *     summary: Lấy danh sách thẻ/token đã lưu của người dùng
 *     tags: [Payment]
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Danh sách token
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id: { type: string }
 *                   userId: { type: string }
 *                   token: { type: string }
 *                   cardMask: { type: string }
 *                   cardType: { type: string }
 *                   bankCode: { type: string }
 *                   isDefault: { type: boolean }
 *                   status: { type: string }
 */
router.get('/tokens', paymentController.getPaymentTokens);
/**
 * @swagger
 * /api/v1/payment/tokens/{id}:
 *   delete:
 *     summary: Xóa/disable token đã lưu
 *     tags: [Payment]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Deleted
 *       404:
 *         description: Token not found
 */
router.delete('/tokens/:id', paymentController.deletePaymentToken);

module.exports = router;
