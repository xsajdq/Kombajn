
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { goal } = req.body;
    if (!goal) {
        return res.status(400).json({ error: "Project goal is required." });
    }

    if (!process.env.API_KEY) {
        console.error('Google AI API key is not set in environment variables.');
        return res.status(500).json({ error: 'Server configuration error: Missing Google AI API key.' });
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const systemInstruction = `You are a world-class project manager. A user will provide a project goal. Your job is to break it down into a list of actionable tasks. Return a JSON array of objects. Each object must have two properties: "name" (a short, imperative task title) and "description" (a one-sentence explanation of the task). Do not add any commentary. Only return the JSON array.`;
        const userPrompt = `Project Goal: "${goal}"`;
        
        const responseSchema = {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: {
                  type: Type.STRING,
                  description: 'The short, imperative title of the task.',
                },
                description: {
                  type: Type.STRING,
                  description: 'A one-sentence explanation of what the task involves.',
                },
              },
              required: ["name", "description"]
            },
        };

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: userPrompt,
            config: {
                systemInstruction,
                responseMimeType: "application/json",
                responseSchema,
            }
        });

        const jsonStr = (response.text || '').trim();
        if (!jsonStr) {
            throw new Error("AI returned an empty response.");
        }
        const parsedData = JSON.parse(jsonStr);
        return res.status(200).json(parsedData);

    } catch (error: any) {
        console.error("AI Project Planning Error:", error);
        return res.status(500).json({ error: "Failed to generate project plan from AI." });
    }
}
