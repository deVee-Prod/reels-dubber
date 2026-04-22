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
      החזר JSON בלבד במבנה הבא:
      [
        {"word": "מילה", "start": 0.1, "end": 0.5},
        ...
      ]
      חשוב: תן עדיפות עליונה לזמן ההתחלה (start) של כל מילה.
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
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON found");
    
    const transcriptionData = JSON.parse(jsonMatch[0]);

    // חזרה לערכים שעבדו טוב + ליטוש קטן
    const lookahead = 0.18; // הקדמה שמבטיחה פאנץ'
    const blockScale = 0.85; // משאירים 85% מהמילה (יותר יציב מ-65% או 70%)

    const formattedTranscription = [{
      text: transcriptionData.map((w: any) => w.word).join(' '),
      words: transcriptionData.map((w: any, index: number) => {
        const oStart = Number(w.start);
        const oEnd = Number(w.end);
        const duration = oEnd - oStart;

        let start = Math.max(0, oStart - lookahead);
        let end = start + (duration * blockScale);

        // מניעת חפיפה קריטית
        if (index < transcriptionData.length - 1) {
            const nextS = Math.max(0, Number(transcriptionData[index + 1].start) - lookahead);
            if (end > nextS) {
                end = nextS - 0.01; // חיתוך מילימטרי לפני המילה הבאה
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