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
    // משתמשים ב-Gemini 2.5 Flash - מומלץ לוודא שהשם נכון (gemini-1.5-flash)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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
    const cleanJson = responseText.replace(/```json|```/g, "").trim();
    const transcriptionData = JSON.parse(cleanJson);

    // התיקון הקריטי: התאמה למבנה שה-Frontend מצפה לו (Array בתוך Array)
    const formattedTranscription = [{
      text: transcriptionData.map((w: any) => w.word).join(' '),
      words: transcriptionData.map((w: any) => ({
        word: w.word,
        start: Number(w.start),
        end: Number(w.end)
      }))
    }];

    return NextResponse.json({ transcription: formattedTranscription });

  } catch (error: any) {
    console.error("Gemini Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}