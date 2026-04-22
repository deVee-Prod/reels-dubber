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
    // וודא שהמודל הוא gemini-1.5-flash או gemini-2.5-flash-exp (תלוי מה זמין לך ב-API Key)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const arrayBuffer = await file.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');

    const prompt = `
      תמלל את האודיו המצורף מילה במילה בצורה קיצונית.
      הנחיות חשובות:
      1. החזר JSON בלבד.
      2. לכל מילה (word) חייב להיות זמן התחלה (start) וזמן סיום (end) מדויקים בשניות.
      3. התמקד ברגע ה-Attack (הצליל הראשון) של כל מילה. אל תעגל זמנים.
      4. אם יש מוזיקה ברקע, התעלם ממנה והתמקד רק בקול האנושי.
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

    // לוגיקת הדיוק הסופית:
    // 1. הקדמה של 200 מילישניות (ה-Sweet Spot למוזיקה)
    // 2. קיצור משך המילה ב-10% כדי למנוע "מריחה"
    const lookahead = 0.20; 

    const formattedTranscription = [{
      text: transcriptionData.map((w: any) => w.word).join(' '),
      words: transcriptionData.map((w: any) => {
        const start = Math.max(0, Number(w.start) - lookahead);
        const end = Number(w.end);
        // מוודאים שהמילה לא נעלמת מהר מדי אבל גם לא נמרחת
        const duration = end - start;
        const safeEnd = start + (duration * 0.9); 

        return {
          word: w.word,
          start: Number(start.toFixed(3)),
          end: Number(safeEnd.toFixed(3))
        };
      })
    }];

    return NextResponse.json({ transcription: formattedTranscription });

  } catch (error: any) {
    console.error("Gemini Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}