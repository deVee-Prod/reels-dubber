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
      תמלל את האודיו המצורף מילה במילה
      החזר JSON בלבד במבנה הבא:
      [
        {"word": "מילה", "start": 0.1, "end": 0.5},
        ...
      ]
      חשוב: דייק מאוד בזמני ההתחלה (start) וזמני הסיום (end) ברמת המילישנייה
      אל תוסיף הסברים או טקסט נוסף
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
    if (!jsonMatch) {
        throw new Error("Could not find JSON in response");
    }
    
    const transcriptionData = JSON.parse(jsonMatch[0]);

    const lookahead = 0.15; 

    const formattedTranscription = [{
      text: transcriptionData.map((w: any) => w.word).join(' '),
      words: transcriptionData.map((w: any, index: number) => {
        const originalStart = Number(w.start);
        const originalEnd = Number(w.end);
        const duration = originalEnd - originalStart;

        let start = Math.max(0, originalStart - lookahead);
        
        // האינטואיציה שלך בפעולה: מקצצים את אורך הבלוק ב-30%
        let end = start + (duration * 0.70);

        // מנגנון הגנה חריף: מוודא חיתוך לפני שהמילה הבאה נכנסת
        if (index < transcriptionData.length - 1) {
            const nextStartOriginal = Number(transcriptionData[index + 1].start);
            const nextStartCalculated = Math.max(0, nextStartOriginal - lookahead);
            
            if (end > nextStartCalculated) {
                end = nextStartCalculated - 0.05;
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