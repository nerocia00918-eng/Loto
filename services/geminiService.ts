import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;

export const initializeGemini = (apiKey: string) => {
  if (!apiKey) return;
  aiClient = new GoogleGenAI({ apiKey });
};

export const getGeminiCommentary = async (number: number): Promise<string | null> => {
  if (!aiClient) return null;

  try {
    const prompt = `
      Bạn là một MC hoạt náo viên vui tính trong trò chơi Lô tô của Việt Nam.
      Số vừa bốc được là: ${number}.
      Hãy tạo một câu rao lô tô ngắn (1-2 câu), hài hước hoặc vần điệu liên quan đến số ${number}.
      Chỉ trả về nội dung câu rao, không thêm dẫn dắt.
      Ví dụ số 1: "Gì ra con mấy, con mấy gì ra. Cờ ra con mấy, con mấy gì ra. Trúc xinh trúc mọc đầu đình, em xinh em đứng một mình cũng xinh. Là con số 1, là con số 1."
    `;

    const response = await aiClient.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 }, // Fast response
      }
    });

    return response.text || null;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return null;
  }
};