import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  // בדיקת cookie — בלי cookie אין גישה
  const cookie = req.headers.get('cookie') || '';
  if (!cookie.includes('session_access')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const audioBlob = formData.get('audio') as Blob;
    const lang = formData.get('language') as string | null;

    if (!audioBlob) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    const file = new File([audioBlob], "audio.mp3", { type: "audio/mp3" });

    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
      response_format: "verbose_json",
      timestamp_granularities: ["word"],
      ...(lang ? { language: lang } : {}),
    });

    if (!transcription.words) {
      throw new Error("Word-level timestamps not supported or returned");
    }

    const formattedTranscription = [{
      text: transcription.text,
      words: transcription.words.map((w: any, index: number) => {
        const start = Math.max(0, w.start - 0.04);
        let end = w.end;

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
