// utils/validation.js
// Centralized validation utilities

/**
 * Normalize phone number
 * Removes all non-digit characters, handles +84 prefix
 */
exports.normalizePhone = (phone) => {
  if (!phone) return null;
  
  const phoneStr = phone.toString().trim();
  
  // Remove all non-digit characters except +
  const cleaned = phoneStr.replace(/[^\d+]/g, '');
  
  // Handle different formats
  if (cleaned.startsWith('+84')) {
    return '0' + cleaned.substring(3); // +84912345678 -> 0912345678
  } else if (cleaned.startsWith('84')) {
    return '0' + cleaned.substring(2); // 84912345678 -> 0912345678
  } else if (cleaned.startsWith('0')) {
    return cleaned; // 0912345678 -> 0912345678
  }
  
  return cleaned;
};

/**
 * Validate phone number format
 * Vietnamese phone: 10 digits starting with 0
 */
exports.validatePhone = (phone) => {
  if (!phone) {
    return { valid: false, error: 'missing_phone', message: 'Phone number is required' };
  }
  
  const normalized = exports.normalizePhone(phone);
  
  if (!normalized) {
    return { valid: false, error: 'invalid_phone', message: 'Invalid phone number format' };
  }
  
  // Vietnamese phone: 10 digits, starts with 0
  const phoneRegex = /^0\d{9}$/;
  
  if (!phoneRegex.test(normalized)) {
    return { valid: false, error: 'invalid_phone', message: 'Phone number must be 10 digits starting with 0' };
  }
  
  return { valid: true, phone: normalized };
};

/**
 * Validate OTP code
 * Must be 4 digits
 */
exports.validateOtp = (otp) => {
  if (!otp) {
    return { valid: false, error: 'missing_otp', message: 'OTP code is required' };
  }
  
  const otpStr = otp.toString().trim();
  
  if (!/^\d{4}$/.test(otpStr)) {
    return { valid: false, error: 'invalid_otp_format', message: 'OTP must be exactly 4 digits' };
  }
  
  return { valid: true, otp: otpStr };
};

/**
 * Validate name
 * 1-50 characters, no special chars except spaces, Vietnamese chars
 */
exports.validateName = (name, options = {}) => {
  const { required = false, minLength = 1, maxLength = 50 } = options;
  
  if (!name || name.trim().length === 0) {
    if (required) {
      return { valid: false, error: 'missing_name', message: 'Name is required' };
    }
    return { valid: true, name: null };
  }
  
  if (typeof name !== 'string') {
    return { valid: false, error: 'invalid_name', message: 'Name must be a string' };
  }
  
  const trimmed = name.trim();
  
  if (trimmed.length < minLength) {
    return { valid: false, error: 'invalid_name', message: `Name must be at least ${minLength} characters` };
  }
  
  if (trimmed.length > maxLength) {
    return { valid: false, error: 'invalid_name', message: `Name must not exceed ${maxLength} characters` };
  }
  
  // Allow letters, spaces, Vietnamese characters
  const nameRegex = /^[a-zA-ZÀ-ỹ\s]+$/;
  if (!nameRegex.test(trimmed)) {
    return { valid: false, error: 'invalid_name', message: 'Name can only contain letters and spaces' };
  }
  
  return { valid: true, name: trimmed };
};

/**
 * Validate email
 * Standard email format, max 100 chars
 */
exports.validateEmail = (email, options = {}) => {
  const { required = false, maxLength = 100 } = options;
  
  if (!email || email.trim().length === 0) {
    if (required) {
      return { valid: false, error: 'missing_email', message: 'Email is required' };
    }
    return { valid: true, email: null };
  }
  
  if (typeof email !== 'string') {
    return { valid: false, error: 'invalid_email', message: 'Email must be a string' };
  }
  
  const trimmed = email.trim().toLowerCase();
  
  if (trimmed.length > maxLength) {
    return { valid: false, error: 'invalid_email', message: `Email must not exceed ${maxLength} characters` };
  }
  
  // Standard email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'invalid_email', message: 'Invalid email format' };
  }
  
  return { valid: true, email: trimmed };
};

/**
 * Validate gender
 * Must be: male, female, or other
 */
exports.validateGender = (gender, options = {}) => {
  const { required = false } = options;
  
  if (!gender || gender.trim().length === 0) {
    if (required) {
      return { valid: false, error: 'missing_gender', message: 'Gender is required' };
    }
    return { valid: true, gender: null };
  }
  
  const validGenders = ['male', 'female', 'other'];
  const lowerGender = gender.toLowerCase().trim();
  
  if (!validGenders.includes(lowerGender)) {
    return { valid: false, error: 'invalid_gender', message: 'Gender must be one of: male, female, other' };
  }
  
  return { valid: true, gender: lowerGender };
};

/**
 * Validate date of birth
 * Must be valid date, not in future, reasonable age (1-120 years old)
 */
exports.validateDob = (dob, options = {}) => {
  const { required = false, minAge = 1, maxAge = 120 } = options;
  
  if (!dob) {
    if (required) {
      return { valid: false, error: 'missing_dob', message: 'Date of birth is required' };
    }
    return { valid: true, dob: null };
  }
  
  let date;
  
  // Handle string input (YYYY-MM-DD or dd/mm/yyyy)
  if (typeof dob === 'string') {
    const trimmed = dob.trim();
    
    // Try ISO format first (YYYY-MM-DD)
    date = new Date(trimmed);
    
    // If invalid, try dd/mm/yyyy format
    if (isNaN(date.getTime())) {
      const parts = trimmed.split('/');
      if (parts.length === 3) {
        const [day, month, year] = parts;
        date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
      }
    }
  } else if (dob instanceof Date) {
    date = dob;
  } else {
    return { valid: false, error: 'invalid_dob', message: 'Date of birth must be a valid date' };
  }
  
  // Check if valid date
  if (isNaN(date.getTime())) {
    return { valid: false, error: 'invalid_dob', message: 'Invalid date format. Use YYYY-MM-DD or dd/mm/yyyy' };
  }
  
  // Check not in future
  const now = new Date();
  if (date > now) {
    return { valid: false, error: 'invalid_dob', message: 'Date of birth cannot be in the future' };
  }
  
  // Check age range
  const ageInYears = (now - date) / (365.25 * 24 * 60 * 60 * 1000);
  
  if (ageInYears < minAge) {
    return { valid: false, error: 'invalid_dob', message: `Age must be at least ${minAge} years` };
  }
  
  if (ageInYears > maxAge) {
    return { valid: false, error: 'invalid_dob', message: `Age cannot exceed ${maxAge} years` };
  }
  
  return { valid: true, dob: date };
};

/**
 * Validate weight
 * Must be positive number, 20-300 kg
 */
exports.validateWeight = (weight, options = {}) => {
  const { required = false, min = 20, max = 300 } = options;
  
  if (weight === null || weight === undefined || weight === '') {
    if (required) {
      return { valid: false, error: 'missing_weight', message: 'Weight is required' };
    }
    return { valid: true, weight: null };
  }
  
  const weightNum = Number(weight);
  
  if (isNaN(weightNum)) {
    return { valid: false, error: 'invalid_weight', message: 'Weight must be a number' };
  }
  
  if (weightNum < min || weightNum > max) {
    return { valid: false, error: 'invalid_weight', message: `Weight must be between ${min} and ${max} kg` };
  }
  
  return { valid: true, weight: weightNum };
};

/**
 * Validate height
 * Must be positive number, 50-250 cm
 */
exports.validateHeight = (height, options = {}) => {
  const { required = false, min = 50, max = 250 } = options;
  
  if (height === null || height === undefined || height === '') {
    if (required) {
      return { valid: false, error: 'missing_height', message: 'Height is required' };
    }
    return { valid: true, height: null };
  }
  
  const heightNum = Number(height);
  
  if (isNaN(heightNum)) {
    return { valid: false, error: 'invalid_height', message: 'Height must be a number' };
  }
  
  if (heightNum < min || heightNum > max) {
    return { valid: false, error: 'invalid_height', message: `Height must be between ${min} and ${max} cm` };
  }
  
  return { valid: true, height: heightNum };
};

/**
 * Validate avatar URL
 * Must be valid URL, http/https only
 */
exports.validateAvatarUrl = (avatarUrl, options = {}) => {
  const { required = false } = options;
  
  if (!avatarUrl || avatarUrl.trim().length === 0) {
    if (required) {
      return { valid: false, error: 'missing_avatar', message: 'Avatar URL is required' };
    }
    return { valid: true, avatarUrl: null };
  }
  
  if (typeof avatarUrl !== 'string') {
    return { valid: false, error: 'invalid_avatar', message: 'Avatar URL must be a string' };
  }
  
  const trimmed = avatarUrl.trim();
  
  // Validate URL format
  try {
    const url = new URL(trimmed);
    
    // Only allow http/https protocols
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return { valid: false, error: 'invalid_avatar', message: 'Avatar URL must use http or https protocol' };
    }
    
    return { valid: true, avatarUrl: trimmed };
  } catch (e) {
    return { valid: false, error: 'invalid_avatar', message: 'Invalid URL format' };
  }
};

/**
 * Validate profile update data
 * Validates all profile fields at once
 */
exports.validateProfileUpdate = (data) => {
  const errors = {};
  const validated = {};
  
  // Validate each field if provided
  if (data.hasOwnProperty('name')) {
    const result = exports.validateName(data.name, { maxLength: 50 });
    if (!result.valid) {
      errors.name = result;
    } else {
      validated.name = result.name;
    }
  }
  
  if (data.hasOwnProperty('email')) {
    const result = exports.validateEmail(data.email, { maxLength: 100 });
    if (!result.valid) {
      errors.email = result;
    } else {
      validated.email = result.email;
    }
  }
  
  if (data.hasOwnProperty('gender')) {
    const result = exports.validateGender(data.gender);
    if (!result.valid) {
      errors.gender = result;
    } else {
      validated.gender = result.gender;
    }
  }
  
  if (data.hasOwnProperty('dob')) {
    const result = exports.validateDob(data.dob, { minAge: 13, maxAge: 100 });
    if (!result.valid) {
      errors.dob = result;
    } else {
      validated.dob = result.dob;
    }
  }
  
  if (data.hasOwnProperty('weight')) {
    const result = exports.validateWeight(data.weight, { min: 20, max: 300 });
    if (!result.valid) {
      errors.weight = result;
    } else {
      validated.weight = result.weight;
    }
  }
  
  if (data.hasOwnProperty('height')) {
    const result = exports.validateHeight(data.height, { min: 50, max: 250 });
    if (!result.valid) {
      errors.height = result;
    } else {
      validated.height = result.height;
    }
  }
  
  if (data.hasOwnProperty('avatarUrl')) {
    const result = exports.validateAvatarUrl(data.avatarUrl);
    if (!result.valid) {
      errors.avatarUrl = result;
    } else {
      validated.avatarUrl = result.avatarUrl;
    }
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors,
    data: validated
  };
};

/**
 * Validate skills array (for PT)
 * Must be array with valid skill values
 * Skills must match video categories: workout, cardio, stretching, nutrition, yoga, other
 */
exports.validateSkills = (skills, options = {}) => {
  const { required = false } = options;
  const ALLOWED_SKILLS = ['workout', 'cardio', 'stretching', 'nutrition', 'yoga', 'other'];
  
  if (!skills) {
    if (required) {
      return { valid: false, error: 'missing_skills', message: 'Skills are required' };
    }
    return { valid: true, skills: [] };
  }
  
  if (!Array.isArray(skills)) {
    return { valid: false, error: 'invalid_skills_type', message: 'Skills must be an array' };
  }
  
  if (skills.length === 0) {
    if (required) {
      return { valid: false, error: 'empty_skills', message: 'At least one skill is required' };
    }
    return { valid: true, skills: [] };
  }
  
  // Check for duplicates
  const uniqueSkills = [...new Set(skills)];
  if (uniqueSkills.length !== skills.length) {
    return { valid: false, error: 'duplicate_skills', message: 'Duplicate skills detected' };
  }
  
  // Check if all skills are valid
  const invalidSkills = skills.filter(s => !ALLOWED_SKILLS.includes(s));
  if (invalidSkills.length > 0) {
    return {
      valid: false,
      error: 'invalid_skills_value',
      message: `Invalid skills: ${invalidSkills.join(', ')}. Allowed: ${ALLOWED_SKILLS.join(', ')}`
    };
  }
  
  return { valid: true, skills: uniqueSkills };
};

/**
 * Validate PT (Staff) creation request
 * Combines phone, name, email, skills, and profile fields validation
 */
exports.validateCreateStaffRequest = (data) => {
  const errors = [];
  const validated = {};
  
  // Phone - REQUIRED
  const phoneValidation = exports.validatePhone(data.phone);
  if (!phoneValidation.valid) {
    errors.push({
      field: 'phone',
      error: phoneValidation.error,
      message: phoneValidation.message
    });
  } else {
    validated.phone = phoneValidation.phone;
  }
  
  // Name - REQUIRED
  const nameValidation = exports.validateName(data.name, { required: true, minLength: 2, maxLength: 100 });
  if (!nameValidation.valid) {
    errors.push({
      field: 'name',
      error: nameValidation.error,
      message: nameValidation.message
    });
  } else {
    validated.name = nameValidation.name;
  }
  
  // Email - OPTIONAL
  if (data.email) {
    const emailValidation = exports.validateEmail(data.email, { required: false, maxLength: 100 });
    if (!emailValidation.valid) {
      errors.push({
        field: 'email',
        error: emailValidation.error,
        message: emailValidation.message
      });
    } else if (emailValidation.email) {
      validated.email = emailValidation.email;
    }
  }
  
  // Skills - REQUIRED
  const skillsValidation = exports.validateSkills(data.skills, { required: true });
  if (!skillsValidation.valid) {
    errors.push({
      field: 'skills',
      error: skillsValidation.error,
      message: skillsValidation.message
    });
  } else {
    validated.skills = skillsValidation.skills;
  }
  
  // Gender - OPTIONAL
  if (data.gender) {
    const genderValidation = exports.validateGender(data.gender);
    if (!genderValidation.valid) {
      errors.push({
        field: 'gender',
        error: genderValidation.error,
        message: genderValidation.message
      });
    } else if (genderValidation.gender) {
      validated.gender = genderValidation.gender;
    }
  }
  
  // DOB - OPTIONAL
  if (data.dob) {
    const dobValidation = exports.validateDob(data.dob, { required: false });
    if (!dobValidation.valid) {
      errors.push({
        field: 'dob',
        error: dobValidation.error,
        message: dobValidation.message
      });
    } else if (dobValidation.dob) {
      validated.dob = dobValidation.dob;
    }
  }
  
  // Height - OPTIONAL
  if (data.height !== undefined && data.height !== null && data.height !== '') {
    const heightValidation = exports.validateHeight(data.height, { required: false, min: 100, max: 250 });
    if (!heightValidation.valid) {
      errors.push({
        field: 'height',
        error: heightValidation.error,
        message: heightValidation.message
      });
    } else if (heightValidation.height) {
      validated.height = heightValidation.height;
    }
  }
  
  // Weight - OPTIONAL
  if (data.weight !== undefined && data.weight !== null && data.weight !== '') {
    const weightValidation = exports.validateWeight(data.weight, { required: false, min: 30, max: 200 });
    if (!weightValidation.valid) {
      errors.push({
        field: 'weight',
        error: weightValidation.error,
        message: weightValidation.message
      });
    } else if (weightValidation.weight) {
      validated.weight = weightValidation.weight;
    }
  }
  
  return {
    valid: errors.length === 0,
    data: validated,
    errors
  };
};
