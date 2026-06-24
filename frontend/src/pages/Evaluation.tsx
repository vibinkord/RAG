import React, { useState, useEffect } from 'react';
import { websiteStore } from '../store/websiteStore';
import { apiService } from '../services/api';
import { Website, EvaluationResponse } from '../types';
import { 
  Award, 
  Loader2, 
  Star, 
  HelpCircle, 
  Zap, 
  Clock, 
  AlignLeft, 
  FileText,
  ExternalLink
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Select } from '../components/ui/Select';

// -------------------------------------------------------------
// Visual Circular Gauge component
// -------------------------------------------------------------
interface CircularGaugeProps {
  value: number; // 0 to 100
  label: string; // e.g. "4.0/5.0"
  title: string;
  description: string;
  color: string;
}

const CircularGauge: React.FC<CircularGaugeProps> = ({ value, label, title, description, color }) => {
  const radius = 32;
  const strokeWidth = 7;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className="flex items-center space-x-4 bg-zinc-900/40 border border-zinc-800/80 p-4 rounded hover:border-zinc-700/80 transition-colors">
      <div className="relative h-18 w-18 shrink-0">
        <svg className="transform -rotate-90 h-18 w-18" viewBox="0 0 80 80">
          <circle 
            cx="40" 
            cy="40" 
            r={radius} 
            fill="none" 
            stroke="#1F2937" 
            strokeWidth={strokeWidth} 
          />
          <circle 
            cx="40" 
            cy="40" 
            r={radius} 
            fill="none" 
            stroke={color} 
            strokeWidth={strokeWidth} 
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center font-mono font-bold text-xs text-white">
          {label}
        </div>
      </div>
      <div className="space-y-0.5">
        <h4 className="text-xs font-semibold text-zinc-200">{title}</h4>
        <p className="text-[10px] text-zinc-550 leading-normal">{description}</p>
      </div>
    </div>
  );
};

// Friendly domain helper
const getFriendlyName = (url: string): string => {
  try {
    const cleanUrl = url.trim().toLowerCase();
    const host = new URL(cleanUrl.startsWith('http') ? cleanUrl : 'https://' + cleanUrl).hostname;
    const mappings: Record<string, string> = {
      'spring.io': 'Spring Documentation',
      'react.dev': 'React Core Docs',
      'nextjs.org': 'Next.js Framework Docs',
      'tailwindcss.com': 'Tailwind Style Guide',
      'github.com': 'GitHub Hub',
      'claysys.com': 'ClaySys Knowledge Base'
    };
    const hostKey = host.replace(/^www\./, '');
    if (mappings[hostKey]) return mappings[hostKey];
    return hostKey;
  } catch (e) {
    return url;
  }
};

export const Evaluation: React.FC = () => {
  const [websites, setWebsites] = useState<Website[]>([]);
  
  // Inputs
  const [question, setQuestion] = useState('');
  const [expectedAnswer, setExpectedAnswer] = useState('');
  const [selectedWebsiteId, setSelectedWebsiteId] = useState('all');
  const [selectedPageType, setSelectedPageType] = useState('');
  
  // Output
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EvaluationResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const list = websiteStore.getWebsites().filter(w => w.status === 'CRAWLED');
    setWebsites(list);
  }, []);

  const handleEvaluate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !expectedAnswer.trim()) return;

    setLoading(true);
    setErrorMsg(null);
    setResult(null);

    const siteId = selectedWebsiteId === 'all' ? undefined : parseInt(selectedWebsiteId);

    try {
      const response = await apiService.evaluate(
        question.trim(),
        expectedAnswer.trim(),
        siteId,
        undefined,
        selectedPageType || undefined
      );
      setResult(response);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.response?.data?.message || e.message || 'Evaluation pipeline execution failed. Ensure LLM grader connection.');
    } finally {
      setLoading(false);
    }
  };

  const websiteOptions = [
    { value: 'all', label: 'All Knowledge Sources' },
    ...websites.map(w => ({ value: w.id.toString(), label: getFriendlyName(w.url) }))
  ];

  // Helper values to populate Gauges
  const correctnessPercent = result ? Math.round((result.factualCorrectnessScore / 5.0) * 100) : 0;
  const similarityPercent = result ? Math.round(result.similarityScore * 100) : 0;
  const confidencePercent = result 
    ? Math.round((result.similarityScore * 0.4 + (result.factualCorrectnessScore / 5.0) * 0.6) * 100)
    : 0;

  return (
    <div className="space-y-8 w-full animate-fade-in">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-slate-50 tracking-tight">Answer Evaluation</h2>
        <p className="text-xs text-zinc-400 mt-1">Audit answers correctness, verify semantic similarity ratings, and check consensus confidence metrics.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Setup Column */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="bg-[#111827] border-zinc-800">
            <CardHeader className="p-5 border-b border-zinc-850">
              <div className="flex items-center space-x-2">
                <Award className="h-4 w-4 text-zinc-400" />
                <CardTitle className="text-sm font-semibold">Evaluation Setup</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-5">
              <form onSubmit={handleEvaluate} className="space-y-4">
                
                {/* Website Source selection */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Target Knowledge Source</label>
                  <Select 
                    value={selectedWebsiteId}
                    onChange={(e) => setSelectedWebsiteId(e.target.value)}
                    options={websiteOptions}
                    className="text-xs h-10 bg-black border-zinc-850"
                  />
                </div>

                {/* Metadata pageType filter */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Page Category Filter</label>
                  <Input 
                    type="text" 
                    placeholder="e.g. guide, tutorial"
                    value={selectedPageType}
                    onChange={(e) => setSelectedPageType(e.target.value)}
                    className="text-xs h-10 bg-black border-zinc-850"
                  />
                </div>

                {/* Question */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Benchmark Question</label>
                  <textarea 
                    placeholder="e.g. What is the default Tomcat port?"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    required
                    rows={2}
                    className="flex w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-505 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                {/* Ground Truth expected answer */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Expected Ground Truth Answer</label>
                  <textarea 
                    placeholder="e.g. The default port is 8080. You can change it in application.properties."
                    value={expectedAnswer}
                    onChange={(e) => setExpectedAnswer(e.target.value)}
                    required
                    rows={3}
                    className="flex w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-505 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                {/* Submit button */}
                <Button 
                  type="submit" 
                  disabled={loading || !question.trim() || !expectedAnswer.trim()}
                  className="w-full h-10 text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-500/10"
                >
                  {loading ? 'Evaluating response...' : 'Run Correctness Grader'}
                </Button>

              </form>
            </CardContent>
          </Card>
        </div>

        {/* Results Column */}
        <div className="lg:col-span-2 space-y-6">
          {errorMsg && (
            <div className="bg-red-950/20 border border-red-900/60 p-4 rounded text-xs text-red-300">
              {errorMsg}
            </div>
          )}

          {loading ? (
            <Card className="bg-[#111827] border-zinc-800 h-96 flex flex-col items-center justify-center text-center p-6">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-4" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-zinc-200">Executing Correctness Grader...</p>
                <p className="text-xs text-zinc-550 max-w-xs leading-relaxed font-mono">
                  Synthesizing answers, mapping vector layouts, and comparing outputs through LLM grader thresholds.
                </p>
              </div>
            </Card>
          ) : !result ? (
            <Card className="bg-[#111827] border-zinc-800 h-96 flex flex-col items-center justify-center text-center p-6">
              <HelpCircle className="h-8 w-8 text-zinc-700 mb-3" />
              <div className="space-y-1.5 max-w-sm">
                <p className="text-sm font-semibold text-zinc-300">Awaiting Evaluation</p>
                <p className="text-xs text-zinc-550 leading-relaxed">
                  Submit a benchmark question with its expected ground-truth documentation. The grader will analyze accuracy and calculate ratings.
                </p>
              </div>
            </Card>
          ) : (
            <div className="space-y-6">
              
              {/* Circular Gauges */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <CircularGauge 
                  value={correctnessPercent}
                  label={`${result.factualCorrectnessScore.toFixed(1)}`}
                  title="Factual Correctness"
                  description="Grades factual accuracy against expected documentation criteria."
                  color="#10B981"
                />
                
                <CircularGauge 
                  value={similarityPercent}
                  label={`${result.similarityScore.toFixed(2)}`}
                  title="Semantic Similarity"
                  description="Indicates reference context layout vector closeness."
                  color="#3B82F6"
                />

                <CircularGauge 
                  value={confidencePercent}
                  label={`${confidencePercent}%`}
                  title="Consensus Confidence"
                  description="Aggregate consensus rating generated by LLM grader constraints."
                  color="#F59E0B"
                />
              </div>

              {/* Side-by-side answers */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Card className="bg-zinc-950 border-zinc-850">
                  <CardHeader className="p-4 border-b border-zinc-900">
                    <CardTitle className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Ground Truth Expected Answer</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <p className="text-xs leading-relaxed text-zinc-300 bg-[#111827]/40 border border-zinc-855 p-3 rounded font-mono select-all min-h-[100px]">
                      {result.expectedAnswer}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-zinc-950 border-zinc-850">
                  <CardHeader className="p-4 border-b border-zinc-900">
                    <CardTitle className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Pipeline Generated Response</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <p className="text-xs leading-relaxed text-zinc-300 bg-[#111827]/40 border border-zinc-855 p-3 rounded font-mono select-all min-h-[100px]">
                      {result.generatedAnswer}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Grader Critique */}
              <Card className="bg-[#111827] border-zinc-800">
                <CardHeader className="p-5 border-b border-zinc-850">
                  <div className="flex items-center space-x-2">
                    <AlignLeft className="h-4 w-4 text-zinc-400" />
                    <CardTitle className="text-sm font-semibold">Grader Critique Breakdown</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-5">
                  <p className="text-xs leading-relaxed text-zinc-300 whitespace-pre-wrap">
                    {result.explanation}
                  </p>
                </CardContent>
              </Card>

              {/* Telemetry Metrics */}
              <Card className="bg-[#111827] border-zinc-800">
                <CardHeader className="p-5 border-b border-zinc-850">
                  <div className="flex items-center space-x-2">
                    <Zap className="h-4 w-4 text-zinc-400" />
                    <CardTitle className="text-sm font-semibold">Assessment Telemetry Metrics</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-5 space-y-3 text-xs font-mono">
                  <div className="flex justify-between py-1.5 border-b border-zinc-850">
                    <span className="text-zinc-500">Matching context chunks retrieved:</span>
                    <span className="text-zinc-300 font-semibold">{result.retrievedChunksCount} chunks</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-zinc-850">
                    <span className="text-zinc-500">Vector Search Retrieval:</span>
                    <span className="text-zinc-300 font-semibold">{result.retrievalLatencyMs} ms</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-zinc-850">
                    <span className="text-zinc-500">LLM Output Synthesis:</span>
                    <span className="text-zinc-300 font-semibold">{result.generationLatencyMs} ms</span>
                  </div>
                  <div className="flex justify-between py-1.5 font-bold">
                    <span className="text-zinc-355">Total pipeline overhead:</span>
                    <span className="text-white bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded">{result.totalLatencyMs} ms</span>
                  </div>
                </CardContent>
              </Card>

            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default Evaluation;
