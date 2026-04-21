import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('audio') as Blob;
    
    if (!file) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // המרת ה-Blob ל-Buffer ומשם ל-Base64
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const audioContent = buffer.toString('base64');

    const apiKey = process.env.GOOGLE_API_KEY; // וודא שזה השם ב-Vercel

    const response = await fetch(
      `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            encoding: 'MP3',
            sampleRateHertz: 16000,
            languageCode: 'he-IL', // עברית כברירת מחדל, אפשר לשנות
            enableWordTimeOffsets: true, // קריטי לכתוביות!
          },
          audio: {
            content: audioContent,
          },
        }),
      }
    );

    const data = await response.json();
    
    // ניקוי הדאטה כדי שיחזור רק מה שצריך לטיימליין
    const transcription = data.results?.map((result: any) => ({
      text: result.alternatives[0].transcript,
      words: result.alternatives[0].words.map((w: any) => ({
        word: w.word,
        start: parseFloat(w.startTime.replace('s', '')),
        end: parseFloat(w.endTime.replace('s', '')),
      }))
    }));

    return NextResponse.json({ transcription });

  } catch (error) {
    console.error('Transcription error:', error);
    return NextResponse.json({ error: 'Failed to transcribe' }, { status: 500 });
  }
}