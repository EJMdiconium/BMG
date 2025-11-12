
import OpenAI from "openai";
import type { RiskLevel, StepResult, UseCase } from "../types";

const API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

if (!API_KEY) {
  console.error("OpenAI API key not found. Please set the VITE_OPENAI_API_KEY environment variable.");
}

const openai = new OpenAI({ apiKey: API_KEY!, dangerouslyAllowBrowser: true });

interface AnalysisResponse {
  is_prohibited?: boolean;
  is_high_risk?: boolean;
  is_limited_risk?: boolean;
  reason: string;
}

export const analyzeUseCase = async (prompt: string, schema: object): Promise<AnalysisResponse> => {
  if (!API_KEY) {
    console.warn("⚠️ API Key not configured");
    return Promise.resolve({ reason: "API Key not configured." });
  }

  console.log("🤖 Calling OpenAI API (analyzeUseCase) with model: gpt-5-nano");
  console.log("📝 Prompt length:", prompt.length, "characters");

  try {
    const startTime = Date.now();
    const response = await openai.chat.completions.create({
      model: 'gpt-5-nano',
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });
    const duration = Date.now() - startTime;
    
    console.log(`✅ OpenAI response received in ${duration}ms`);
    console.log("📊 Tokens used:", response.usage?.total_tokens || "N/A");
    
    const text = response.choices[0].message.content;
    if (!text) {
        console.error("❌ No content in response");
        return { reason: "No response from AI." };
    }
    
    const parsed = JSON.parse(text) as AnalysisResponse;
    console.log("✓ Successfully parsed JSON response");
    return parsed;

  } catch (error) {
    console.error("❌ Error analyzing use case:", error);
    let errorMessage = "An unknown error occurred while contacting the AI.";
    if (error instanceof Error) {
        errorMessage = `Error: ${error.message}`;
    }
    return { reason: errorMessage };
  }
};


const generateText = async (prompt: string, context: string = "text generation"): Promise<string> => {
    if (!API_KEY) {
      console.warn("⚠️ API Key not configured");
      return "API Key not configured.";
    }
  
    console.log(`🤖 Calling OpenAI API (${context}) with model: gpt-5-nano`);
    console.log("📝 Prompt length:", prompt.length, "characters");
  
    try {
      const startTime = Date.now();
      const response = await openai.chat.completions.create({
        model: 'gpt-5-nano',
        messages: [{ role: "user", content: prompt }],
      });
      const duration = Date.now() - startTime;
      
      console.log(`✅ OpenAI response received in ${duration}ms`);
      console.log("📊 Tokens used:", response.usage?.total_tokens || "N/A");
      
      const content = response.choices[0].message.content ?? "No response from AI.";
      console.log(`✓ Response length: ${content.length} characters`);
      return content;
    } catch (error) {
      console.error(`❌ Error in ${context}:`, error);
      if (error instanceof Error) {
        return `Error: ${error.message}`;
      }
      return "An unknown error occurred while contacting the AI.";
    }
  };

export const optimizeUseCaseDescription = (description: string): Promise<string> => {
    console.log("🔄 Starting use case description optimization...");
    const prompt = `Please reformulate the following AI use case description into a clear, concise, and structured paragraph suitable for a formal risk assessment under the EU AI Act. Focus on the core functionality, the data used, the intended users, and the decision-making process it influences. Return only the optimized paragraph.
    
    User Input: "${description}"
    
    Optimized Description:`;
    return generateText(prompt, "optimize description");
};

export const generateFinalSummary = (results: StepResult[], useCase: UseCase): Promise<string> => {
    console.log("📋 Starting final summary generation...");
    const analysisLog = results.map(r => {
      let log = `- ${r.stepName}: Your decision was "${r.humanDecision}".\n  - AI Rationale: ${r.aiAnalysis}`;
      if (r.humanRationale) {
        log += `\n  - Your Rationale for Disagreement: ${r.humanRationale}`;
      }
      return log;
    }).join('\n');

    const prompt = `
        As an expert on the EU AI Act, you have completed a step-by-step risk analysis for an AI system, including human oversight.
        Now, synthesize all the findings into a final, cohesive summary.
        Do not simply list the steps. Instead, create a brief narrative that explains the final risk classification based on the key findings from the analysis.
        Crucially, if the human operator provided their own rationale for disagreeing with the AI, you must incorporate and address that reasoning in your final summary.

        Use Case Description: "${useCase.description}"

        Analysis Log (including human decisions and rationale):
        ${analysisLog}

        Provide the final summary below.
    `;
    return generateText(prompt, "final summary");
};

export const generateMitigationSuggestions = (riskLevel: RiskLevel, results: StepResult[], useCase: UseCase): Promise<string> => {
    console.log("🛡️ Starting mitigation suggestions generation...");
    const relevantResults = results.filter(r => r.isPositive).map(r => `For the "${r.stepName}", the AI found: ${r.aiAnalysis}`).join('\n');
    const prompt = `
        An AI system has been classified as "${riskLevel}" under the EU AI Act.
        Use Case: "${useCase.description}"
        Key Risk Findings:
        ${relevantResults}

        Based on these findings, provide a concise, actionable list of suggestions to mitigate the identified risks.
        - If the risk is "Unacceptable Risk", explain clearly that mitigation is not possible and the practice must be avoided.
        - If "High-Risk", suggest steps related to conformity assessments, data governance, transparency, and human oversight.
        - If "Limited Risk", suggest specific transparency measures that need to be implemented (e.g., informing users they are interacting with an AI).

        Your suggestions should be practical and directly related to the findings.
    `;
    return generateText(prompt, "mitigation suggestions");
};