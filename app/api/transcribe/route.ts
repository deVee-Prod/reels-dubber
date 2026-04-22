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
      תמלל את האודיו מילה במילה
      החזר JSON בלבד במבנה הבא:
      [
        {"word": "מילה", "start": 0.1, "end": 0.5},
        ...
      ]
      חשוב: תן עדיפות עליונה לזמן ההתחלה (start) של כל מילה
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

    const formattedTranscription = [{
      text: transcriptionData.map((w: any) => w.word).join(' '),
      words: transcriptionData.map((w: any, index: number) => {
        const oStart = Number(w.start);
        const oEnd = Number(w.end);
        const duration = oEnd - oStart;

        // אלגוריתם קיזוז דינמי (Dynamic Lookahead)
        let lookahead = 0.15; 
        if (duration < 0.35) {
            lookahead = 0.22; // דיבור מהיר - הקדמה אגרסיבית
        } else if (duration > 0.6) {
            lookahead = 0.10; // דיבור איטי - הקדמה עדינה
        }

        let start = Math.max(0, oStart - lookahead);
        
        // כיווץ משך המילה דינמי - חותכים יותר חזק במילים מהירות
        const blockScale = duration < 0.35 ? 0.75 : 0.85; 
        let end = start + (duration * blockScale);

        // מניעת התנגשויות שלוקחת בחשבון את המילה הבאה
        if (index < transcriptionData.length - 1) {
            const nextOStart = Number(transcriptionData[index + 1].start);
            const nextDuration = Number(transcriptionData[index + 1].end) - nextOStart;
            
            let nextLookahead = 0.15;
            if (nextDuration < 0.35) nextLookahead = 0.22;
            else if (nextDuration > 0.6) nextLookahead = 0.10;

            const nextS = Math.max(0, nextOStart - nextLookahead);
            
            if (end > nextS) {
                end = nextS - 0.01; 
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