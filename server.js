require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Groq = require('groq-sdk');

const app = express();
const port = process.env.PORT || 3000;

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

app.use(cors());
app.use(express.json());

// Личности
const PERSONAS = {
    // 1. Строгий Senior
    "strict": `Ты строгий Senior Frontend Developer, проводящий техническое интервью. 
    Твой стиль общения: профессиональный, сухой, требовательный. 
    Ты не терпишь "воды" в ответах. Ты ищешь глубокое понимание, а не заученные фразы.
    Если кандидат ошибается, прямо указывай на ошибку и спрашивай, как это исправить.
    Не давай подсказок сразу, заставляй кандидата думать.`,

    // 2. Добряк Ментор
    "kind": `Ты дружелюбный и эмпатичный ментор по программированию. 
    Твоя цель: помочь ученику разобраться, даже если он ошибается. 
    Твой стиль общения: поддерживающий, мягкий, используй простые аналогии.
    Если ответ неверный, похвали за попытку и мягко направь к правильному решению наводящим вопросом.`
};

const createSystemPrompt = (mentorType, topic, level) => {
    const basePersona = PERSONAS[mentorType] || PERSONAS["strict"];
    
    return `${basePersona}
    
    ПАРАМЕТРЫ ТЕКУЩЕЙ СЕССИИ:
    - Тема интервью: ${topic || "Общие вопросы по веб-разработке"}
    - Уровень сложности вопросов: ${level || "Middle"}
    
    Твоя задача: Провести интервью или ответить на вопросы строго в рамках темы "${topic}" для уровня "${level}".`;
};

app.post('/api/chat', async (req, res) => {
    const { message, mentorType, topic, level } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }

    const systemInstruction = createSystemPrompt(mentorType, topic, level);

    console.log('--- New Request ---');
    console.log('Topic:', topic, '| Level:', level, '| Mentor:', mentorType);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: systemInstruction
                },
                {
                    role: "user",
                    content: message
                }
            ],
            model: "llama3-8b-8192", 
            stream: true,
        });

        for await (const chunk of chatCompletion) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
                res.write(`data: ${JSON.stringify({ content })}\n\n`);
            }
        }

        res.write('data: [DONE]\n\n');
        res.end();

    } catch (error) {
        console.error('Groq API Error:', error);
        res.write(`data: ${JSON.stringify({ error: 'Error connecting to AI' })}\n\n`);
        res.end();
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});