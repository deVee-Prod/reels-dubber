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
    // חזרה ל-2.5 Flash כמו שביקשת!
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const arrayBuffer = await file.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');

    const prompt = `
      תמלל את האודיו המצורף מילה במילה.
      החזר JSON בלבד במבנה הבא:
      [
        {"word": "מילה", "start": 0.1, "end": 0.5},
        ...
      ]
      חשוב: דייק מאוד בזמני ההתחלה (start). אל תוסיף הסברים או טקסט נוסף.
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
    
    // שליפת ה-JSON מתוך התשובה (מטפל במקרים שהמודל מוסיף ```json)
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
        throw new Error("Could not find JSON in response");
    }
    
    const transcriptionData = JSON.parse(jsonMatch[0]);

    // האסטרטגיה לדיוק: 200 מילישניות הקדמה (lookahead)
    const lookahead = 0.20; 

    const formattedTranscription = [{
      text: transcriptionData.map((w: any) => w.word).join(' '),
      words: transcriptionData.map((w: any) => {
        const start = Math.max(0, Number(w.start) - lookahead);
        const end = Number(w.end);
        return {
          word: w.word,
          start: Number(start.toFixed(3)),
          end: Number(end.toFixed(3))
        };
      })
    }];

    return NextResponse.json({ transcription: formattedTranscription });

  } catch (error: any) {
    console.error("Gemini Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}