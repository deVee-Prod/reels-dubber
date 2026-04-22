import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const audioBlob = formData.get('audio') as Blob;
    
    if (!audioBlob) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    const file = new File([audioBlob], "audio.mp3", { type: "audio/mp3" });

    // השימוש ב-whisper-1 מבטיח את המנוע הכי עדכני שלהם
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1", // זה ה-V3 האופטימלי
      response_format: "verbose_json", // חובה כדי לקבל נתונים מפורטים
      timestamp_granularities: ["word"], // היכולת החדשה ביותר לסנכרון מילים
      language: "he", 
    });

    if (!transcription.words) {
      throw new Error("Word-level timestamps not supported or returned");
    }

    const formattedTranscription = [{
      text: transcription.text,
      words: transcription.words.map((w: any, index: number) => {
        // ב-Whisper העדכני, ה-Start הוא ה-Transient האמיתי.
        // אנחנו נותנים קיזוז של 40ms רק בשביל הפסיכולוגיה של העין
        const start = Math.max(0, w.start - 0.04);
        let end = w.end;

        // מניעת חפיפה
        if (transcription.words && index < transcription.words.length - 1) {
          const nextStart = transcription.words[index + 1].start - 0.04;
          if (end > nextStart) {
            end = nextStart - 0.01;
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
    console.error("Whisper API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}