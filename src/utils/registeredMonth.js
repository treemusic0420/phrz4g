import { toDate } from './format';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

const getJstYearMonth = (value = new Date()) => {
  const date = toDate(value) || new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  return { year: year || '1970', month: month || '01' };
};

export const isValidRegisteredMonth = (value = '') => MONTH_PATTERN.test(String(value));

export const getRegisteredMonthLabel = (registeredMonth = '') => {
  if (!isValidRegisteredMonth(registeredMonth)) {
    return '1970-January';
  }
  const [year, month] = registeredMonth.split('-');
  return `${year}-${MONTH_NAMES[Number(month) - 1] || 'January'}`;
};

export const getRegisteredMonthFieldsFromDate = (value = new Date()) => {
  const { year, month } = getJstYearMonth(value);
  const registeredMonth = `${year}-${month}`;
  return {
    registeredMonth,
    registeredMonthLabel: getRegisteredMonthLabel(registeredMonth),
  };
};

export const resolveRegisteredMonthFields = ({
  registeredMonth,
  registeredMonthLabel,
  createdAt,
  fallbackDate = new Date(),
} = {}) => {
  if (isValidRegisteredMonth(registeredMonth)) {
    return {
      registeredMonth,
      registeredMonthLabel: registeredMonthLabel || getRegisteredMonthLabel(registeredMonth),
    };
  }

  const createdDate = toDate(createdAt);
  return getRegisteredMonthFieldsFromDate(createdDate || fallbackDate);
};
