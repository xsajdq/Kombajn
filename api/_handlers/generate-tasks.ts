
// api/_handlers/generate-tasks.ts
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { promptText } = req.body;
    if (!promptText) {
        return res.status(400).json({ error: "Prompt text is required." });
    }

    if (!process.env.API_KEY) {
        console.error('Google AI API key is not set in environment variables.');
        return res.status(500).json({ error: 'Server configuration error: Missing Google AI API key.' });
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const systemInstruction = `You are an expert project manager. Your task is to break down a user's high-level project idea into a list of specific, actionable tasks. Respond ONLY with a valid JSON array of objects. Do not include any other text, explanations, or markdown formatting around the JSON. The JSON schema for the response should be an array of objects, where each object has a "name" (a short, clear task title) and a "description" (a one-sentence explanation of what the task involves).`;
        const userPrompt = `Generate a list of tasks for the following project: "${promptText}".`;

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: userPrompt,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
            }
        });

        // Safely access response.text to prevent build errors
        let jsonStr = (response.text || '').trim();
        const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
        const match = jsonStr.match(fenceRegex);
        if (match && match[2]) {
          jsonStr = match[2].trim();
        }

        const parsedData = JSON.parse(jsonStr);
        return res.status(200).json(parsedData);

    } catch (error: any) {
        console.error("AI Task Generation Error:", error);
        return res.status(500).json({ error: "Failed to generate tasks from AI." });
    }
}
