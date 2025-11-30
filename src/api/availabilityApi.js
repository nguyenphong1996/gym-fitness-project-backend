import createAxiosInstance from '@api/axiosInstance';

export async function getStaffAvailability(date) {
  const axios = createAxiosInstance();
  const response = await axios.get('/api/staff/availability', {
    params: { date },
  });
  return response;
}

export async function setStaffAvailability({ date, slots }) {
  const axios = createAxiosInstance();
  const response = await axios.put('/api/staff/availability', { date, slots });
  return response;
}

export default {
  getStaffAvailability,
  setStaffAvailability,
};
