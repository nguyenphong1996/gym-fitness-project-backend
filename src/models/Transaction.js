const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    packageId: { // Assuming a package ID might be associated with the transaction
        type: mongoose.Schema.Types.ObjectId, // Or String, depending on how packages are stored
        required: false, // Not all transactions might be for a package
    },
    amount: {
        type: Number,
        required: true,
    },
    orderId: { // Our internal order ID, could be mapped to vnp_TxnRef
        type: String,
        required: true,
        unique: true,
    },
    vnpTransactionNo: { // VNPAY's transaction number
        type: String,
        required: false,
    },
    bankCode: {
        type: String,
        required: false,
    },
    cardType: {
        type: String,
        required: false,
    },
    payDate: {
        type: Date,
        required: false,
    },
    responseCode: { // VNPAY's response code (00 for success, etc.)
        type: String,
        required: false,
    },
    transactionStatus: { // Our internal status: pending, success, failed, cancelled
        type: String,
        enum: ['pending', 'success', 'failed', 'cancelled'],
        default: 'pending',
        required: true,
    },
    paymentMethod: {
        type: String,
        default: 'VNPAY',
    },
    transactionDescription: { // For storing vnp_OrderInfo
        type: String,
        required: false,
    }
}, {
    timestamps: true, // Adds createdAt and updatedAt timestamps
});

module.exports = mongoose.model('Transaction', TransactionSchema);
