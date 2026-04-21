import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('audio') as Blob;
    
    if (!file) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const audioContent = Buffer.from(arrayBuffer).toString('base64');
    const apiKey = process.env.GOOGLE_API_KEY;

    const response = await fetch(
      `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            encoding: 'MP3',
            languageCode: 'he-IL',
            enableWordTimeOffsets: true,
          },
          audio: {
            content: audioContent,
          },
        }),
      }
    );

    const data = await response.json();

    // אם גוגל החזירה שגיאה - אנחנו מעבירים אותה ל-Frontend
    if (data.error) {
      return NextResponse.json({ error: data.error.message, code: data.error.code }, { status: 500 });
    }

    if (!data.results) {
      return NextResponse.json({ transcription: [] });
    }
    
    const transcription = data.results.map((result: any) => ({
      text: result.alternatives[0].transcript,
      words: result.alternatives[0].words.map((w: any) => ({
        word: w.word,
        start: parseFloat(w.startTime.replace('s', '')),
        end: parseFloat(w.endTime.replace('s', '')),
      }))
    }));

    return NextResponse.json({ transcription });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}