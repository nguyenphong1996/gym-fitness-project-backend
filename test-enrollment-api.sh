#!/bin/bash

# Phase 3 - Class Enrollment API Test Script
# This script demonstrates all 5 enrollment endpoints

BASE_URL="http://localhost:3000"
CUSTOMER_TOKEN="${CUSTOMER_TOKEN:-your_customer_token_here}"
ADMIN_TOKEN="${ADMIN_TOKEN:-your_admin_token_here}"
CLASS_ID="${CLASS_ID:-your_class_id_here}"
ENROLLMENT_ID="${ENROLLMENT_ID:-your_enrollment_id_here}"

echo "=== Phase 3 - Class Enrollment API Tests ==="
echo ""

# Test 1: Enroll in a class
echo "Test 1: 📝 Đăng ký lớp học"
echo "POST /api/customer/classes/{classId}/enroll"
curl -X POST "$BASE_URL/api/customer/classes/$CLASS_ID/enroll" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
echo -e "\n\n"

# Test 2: Get my enrollments
echo "Test 2: 📋 Danh sách lớp đã đăng ký"
echo "GET /api/customer/enrollments?status=active"
curl -X GET "$BASE_URL/api/customer/enrollments?status=active&page=1&limit=10" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json"
echo -e "\n\n"

# Test 3: Get enrollment details
echo "Test 3: 🔍 Chi tiết enrollment"
echo "GET /api/customer/enrollments/{enrollmentId}"
curl -X GET "$BASE_URL/api/customer/enrollments/$ENROLLMENT_ID" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json"
echo -e "\n\n"

# Test 4: Cancel enrollment
echo "Test 4: ❌ Hủy đăng ký lớp"
echo "PATCH /api/customer/enrollments/{enrollmentId}/cancel"
curl -X PATCH "$BASE_URL/api/customer/enrollments/$ENROLLMENT_ID/cancel" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cancellationReason": "Tôi quá bận công việc"
  }'
echo -e "\n\n"

# Test 5: Admin view class enrollments
echo "Test 5: 👨‍💼 Danh sách enrollments của lớp (Admin)"
echo "GET /api/admin/classes/{classId}/enrollments"
curl -X GET "$BASE_URL/api/admin/classes/$CLASS_ID/enrollments?status=active&page=1&limit=10" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json"
echo -e "\n\n"

echo "=== All tests completed ==="
