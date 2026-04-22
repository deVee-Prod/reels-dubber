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

    const prompt = `
      תמלל את האודיו מילה במילה.
      החזר JSON בלבד: [{"word": "מילה", "start": 1.23, "end": 1.45}]
      דגש קריטי: סמן את ה-start בדיוק ברגע פתיחת הפה (העיצור הראשון).
    `;

    const result = await model.generateContent([
      prompt,
      { inlineData: { mimeType: "audio/mp3", data: base64Audio } }
    ]);

    const responseText = result.response.text();
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON found");
    
    const transcriptionData = JSON.parse(jsonMatch[0]);

    // הגדרות "פינצטה" חדשות:
    const lookahead = 0.08; // הקדמה עדינה יותר כדי לא להקדים מדי
    const tailCut = 0.65;   // קיצוץ זנב אגרסיבי יותר (נשאר רק 65% מהמילה)

    const formattedTranscription = [{
      text: transcriptionData.map((w: any) => w.word).join(' '),
      words: transcriptionData.map((w: any, index: number) => {
        const oStart = Number(w.start);
        const oEnd = Number(w.end);
        const duration = oEnd - oStart;

        let start = Math.max(0, oStart - lookahead);
        // המילה תהיה קצרה ופאנצ'ית
        let end = start + (duration * tailCut);

        // מניעת חפיפה עם המילה הבאה
        if (index < transcriptionData.length - 1) {
            const nextS = Math.max(0, Number(transcriptionData[index + 1].start) - lookahead);
            if (end > nextS) {
                end = nextS - 0.02; // מרווח ביטחון של 20 מילישניות
            }
        }

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