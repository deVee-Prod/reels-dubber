import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('audio') as Blob;
    
    if (!file) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const arrayBuffer = await file.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');

    // שיפור הפרומפט כדי לנסות לדייק את ג'מיני לטרנזיינט הראשון
    const prompt = `
      תמלל את האודיו המצורף בצורה מדויקת מילה במילה
      החזר את התוצאה בפורמט JSON בלבד, שבו לכל מילה יש:
      1. את המילה עצמה (word)
      2. זמן התחלה בשניות (start) - ציין את הרגע המדויק בו נשמע הצליל הראשון של המילה
      3. זמן סיום בשניות (end)
      אל תוסיף הסברים, רק את ה-JSON
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
    const cleanJson = responseText.replace(/```json|```/g, "").trim();
    const transcriptionData = JSON.parse(cleanJson);

    // התיקון שלנו: נקדים כל מילה ב-150 מילישניות כדי למנוע את "שרשרת העיכובים"
    const lookaheadOffset = 0.15; 

    const formattedTranscription = [{
      text: transcriptionData.map((w: any) => w.word).join(' '),
      words: transcriptionData.map((w: any) => ({
        word: w.word,
        // מחסרים את ההקדמה, ומוודאים שלא נרד מתחת ל-0
        start: Math.max(0, Number(w.start) - lookaheadOffset),
        end: Number(w.end)
      }))
    }];

    return NextResponse.json({ transcription: formattedTranscription });

  } catch (error: any) {
    console.error("Gemini Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}