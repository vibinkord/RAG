import React, { useState, useEffect } from 'react';
import { websiteStore } from '../store/websiteStore';
import { apiService } from '../services/api';
import { Website, EvaluationResponse } from '../types';
import { 
  Award, 
  Loader2, 
  HelpCircle, 
  Zap, 
  AlignLeft
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
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
    <div className="flex items-center space-x-4 bg-secondary/50 border border-border p-4 rounded-lg hover:shadow-sm transition-all">
      <div className="relative h-18 w-18 shrink-0">
        <svg className="transform -rotate-90 h-18 w-18" viewBox="0 0 80 80">
          <circle 
            cx="40" 
            cy="40" 
            r={radius} 
            fill="none" 
            stroke="var(--border)" 
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
        <div className="absolute inset-0 flex items-center justify-center font-mono font-bold text-sm text-textPrimary">
          {label}
        </div>
      </div>
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-textPrimary">{title}</h4>
        <p className="text-xs text-textSecondary leading-relaxed">{description}</p>
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
    } catch (error) {
      const e = error as { response?: { data?: { message?: string } }, message?: string };
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
    <div className="space-y-8 w-full animate-fade-in pb-12">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold text-textPrimary tracking-tight">Answer Evaluation</h2>
        <p className="text-sm text-textSecondary mt-1">Audit answers correctness, verify semantic similarity ratings, and check consensus confidence metrics.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Setup Column */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="p-5 border-b border-border/50 bg-secondary/30">
              <div className="flex items-center space-x-2">
                <Award className="h-4 w-4 text-textSecondary" />
                <CardTitle className="text-sm font-semibold">Evaluation Setup</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-5">
              <form onSubmit={handleEvaluate} className="space-y-5">
                
                {/* Website Source selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-textPrimary">Target Knowledge Source</label>
                  <Select 
                    value={selectedWebsiteId}
                    onChange={(e) => setSelectedWebsiteId(e.target.value)}
                    options={websiteOptions}
                    className="text-sm h-10 bg-background border-border focus:border-primary focus:ring-1 focus:ring-primary/20"
                  />
                </div>

                {/* Metadata pageType filter */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-textPrimary">Page Category Filter</label>
                  <Input 
                    type="text" 
                    placeholder="e.g. guide, tutorial"
                    value={selectedPageType}
                    onChange={(e) => setSelectedPageType(e.target.value)}
                    className="text-sm h-10 bg-background border-border focus:border-primary focus:ring-1 focus:ring-primary/20"
                  />
                </div>

                {/* Question */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-textPrimary">Benchmark Question</label>
                  <textarea 
                    placeholder="e.g. What is the default Tomcat port?"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    required
                    rows={3}
                    className="flex w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-textPrimary placeholder:text-textSecondary/50 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 resize-none transition-all"
                  />
                </div>

                {/* Ground Truth expected answer */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-textPrimary">Expected Ground Truth Answer</label>
                  <textarea 
                    placeholder="e.g. The default port is 8080. You can change it in application.properties."
                    value={expectedAnswer}
                    onChange={(e) => setExpectedAnswer(e.target.value)}
                    required
                    rows={4}
                    className="flex w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-textPrimary placeholder:text-textSecondary/50 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 resize-none transition-all"
                  />
                </div>

                {/* Submit button */}
                <Button 
                  type="submit" 
                  disabled={loading || !question.trim() || !expectedAnswer.trim()}
                  className="w-full h-10 text-sm bg-primary hover:bg-primary/90 text-white font-medium shadow-sm mt-2"
                >
                  {loading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Evaluating response...</>
                  ) : (
                    'Run Correctness Grader'
                  )}
                </Button>

              </form>
            </CardContent>
          </Card>
        </div>

        {/* Results Column */}
        <div className="lg:col-span-2 space-y-6">
          {errorMsg && (
            <div className="bg-danger/10 border border-danger/20 p-4 rounded-md text-sm text-danger flex items-start gap-2">
               <HelpCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {errorMsg}
            </div>
          )}

          {loading ? (
            <Card className="bg-card border-border h-[500px] flex flex-col items-center justify-center text-center p-8 shadow-sm">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-5" />
              <div className="space-y-2">
                <p className="text-base font-semibold text-textPrimary">Executing Correctness Grader...</p>
                <p className="text-sm text-textSecondary max-w-sm leading-relaxed mx-auto">
                  Synthesizing answers, mapping vector layouts, and comparing outputs through LLM grader thresholds.
                </p>
              </div>
            </Card>
          ) : !result ? (
            <Card className="bg-card border-border h-[500px] flex flex-col items-center justify-center text-center p-8 shadow-sm">
              <div className="h-16 w-16 bg-secondary rounded-full flex items-center justify-center border border-border mb-4">
                <HelpCircle className="h-8 w-8 text-textSecondary" />
              </div>
              <div className="space-y-2 max-w-md">
                <p className="text-base font-semibold text-textPrimary">Awaiting Evaluation</p>
                <p className="text-sm text-textSecondary leading-relaxed">
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
                  color="var(--success)"
                />
                
                <CircularGauge 
                  value={similarityPercent}
                  label={`${result.similarityScore.toFixed(2)}`}
                  title="Semantic Similarity"
                  description="Indicates reference context layout vector closeness."
                  color="var(--primary)"
                />

                <CircularGauge 
                  value={confidencePercent}
                  label={`${confidencePercent}%`}
                  title="Consensus Confidence"
                  description="Aggregate consensus rating generated by LLM grader constraints."
                  color="var(--warning)"
                />
              </div>

              {/* Side-by-side answers */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Card className="bg-card border-border shadow-sm">
                  <CardHeader className="p-4 border-b border-border/50 bg-secondary/30">
                    <CardTitle className="text-xs font-bold text-textSecondary uppercase tracking-widest">Ground Truth Expected Answer</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <p className="text-sm leading-relaxed text-textPrimary bg-background border border-border/50 p-4 rounded-md font-mono select-all min-h-[120px] whitespace-pre-wrap">
                      {result.expectedAnswer}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border shadow-sm">
                  <CardHeader className="p-4 border-b border-border/50 bg-secondary/30">
                    <CardTitle className="text-xs font-bold text-textSecondary uppercase tracking-widest">Pipeline Generated Response</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <p className="text-sm leading-relaxed text-textPrimary bg-background border border-border/50 p-4 rounded-md font-mono select-all min-h-[120px] whitespace-pre-wrap">
                      {result.generatedAnswer}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Grader Critique */}
              <Card className="bg-card border-border shadow-sm">
                <CardHeader className="p-5 border-b border-border/50 bg-secondary/30">
                  <div className="flex items-center space-x-2">
                    <AlignLeft className="h-4 w-4 text-textSecondary" />
                    <CardTitle className="text-sm font-semibold">Grader Critique Breakdown</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-5">
                  <p className="text-sm leading-relaxed text-textPrimary whitespace-pre-wrap">
                    {result.explanation}
                  </p>
                </CardContent>
              </Card>

              {/* Telemetry Metrics */}
              <Card className="bg-card border-border shadow-sm">
                <CardHeader className="p-5 border-b border-border/50 bg-secondary/30">
                  <div className="flex items-center space-x-2">
                    <Zap className="h-4 w-4 text-textSecondary" />
                    <CardTitle className="text-sm font-semibold">Assessment Telemetry Metrics</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-5 space-y-3 text-sm font-mono">
                  <div className="flex justify-between py-2 border-b border-border/50">
                    <span className="text-textSecondary">Matching context chunks retrieved:</span>
                    <span className="text-textPrimary font-semibold">{result.retrievedChunksCount} chunks</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border/50">
                    <span className="text-textSecondary">Vector Search Retrieval:</span>
                    <span className="text-textPrimary font-semibold">{result.retrievalLatencyMs} ms</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-border/50">
                    <span className="text-textSecondary">LLM Output Synthesis:</span>
                    <span className="text-textPrimary font-semibold">{result.generationLatencyMs} ms</span>
                  </div>
                  <div className="flex justify-between py-2 font-bold">
                    <span className="text-textPrimary">Total pipeline overhead:</span>
                    <span className="text-textPrimary bg-secondary border border-border/50 px-2 py-0.5 rounded-sm">{result.totalLatencyMs} ms</span>
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
