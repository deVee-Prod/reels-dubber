import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('audio') as Blob;
    
    if (!file) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // שימוש במפתח ה-API של הבוט (AI Studio)
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
    // משתמשים ב-Gemini 1.5 Flash - המודל הכי מהיר ומדויק למשימה הזאת
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const arrayBuffer = await file.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');

    const prompt = `
      תמלל את האודיו המצורף בצורה מדויקת מילה במילה.
      החזר את התוצאה בפורמט JSON בלבד, שבו לכל מילה יש:
      1. את המילה עצמה (word).
      2. זמן התחלה בשניות (start).
      3. זמן סיום בשניות (end).
      אל תוסיף הסברים, רק את ה-JSON.
    `;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: "audio/mp3",
          data: base64Audio
        }
      }
    ]);

    const responseText = result.response.text();
    // ניקוי המעטפת של ה-JSON אם המודל הוסיף אותה
    const cleanJson = responseText.replace(/```json|```/g, "").trim();
    const transcriptionData = JSON.parse(cleanJson);

    // התאמה למבנה שה-Frontend שלך מצפה לו
    return NextResponse.json({ transcription: transcriptionData });

  } catch (error: any) {
    console.error("Gemini Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}