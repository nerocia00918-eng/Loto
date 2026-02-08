export const readNumberToVietnamese = (num: number): string => {
  const units = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
  const tens = ["", "mười", "hai mươi", "ba mươi", "bốn mươi", "năm mươi", "sáu mươi", "bảy mươi", "tám mươi", "chín mươi"];

  if (num <= 9) return units[num];
  if (num === 10) return "mười";
  
  const unitDigit = num % 10;
  const tenDigit = Math.floor(num / 10);
  
  let result = tens[tenDigit];
  
  // Xử lý hàng đơn vị
  if (unitDigit === 1) {
    if (tenDigit > 1) result += " mốt";
    else result += " một";
  } else if (unitDigit === 4) {
      if (tenDigit > 1) result += " tư"; 
      else result += " bốn";
  } else if (unitDigit === 5) {
    result += " lăm";
  } else if (unitDigit !== 0) {
    result += " " + units[unitDigit];
  }
  
  return result;
};