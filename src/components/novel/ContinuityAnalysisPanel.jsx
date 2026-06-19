import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Brain, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  TrendingUp, 
  Users, 
  Clock,
  ChevronDown,
  ChevronUp,
  Loader2
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import BlurbDrafterSection from "@/components/novel/BlurbDrafterSection";

const severityColors = {
  low: "bg-blue-100 text-blue-800 border-blue-300",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-300",
  high: "bg-red-100 text-red-800 border-red-300"
};

const typeIcons = {
  character: Users,
  plot: Brain,
  timeline: Clock
};

const typeLabels = {
  character: "ตัวละคร",
  plot: "พล็อตเรื่อง",
  timeline: "ไทม์ไลน์"
};

export default function ContinuityAnalysisPanel({ novelId, chapters, novel }) {
  const [analysis, setAnalysis] = useState(null);
  const [expandedIssues, setExpandedIssues] = useState({});

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('analyzePlotContinuity', { novel_id: novelId });
      return response.data;
    },
  });

  const handleAnalyze = () => {
    analyzeMutation.mutate();
  };

  const toggleIssue = (index) => {
    setExpandedIssues(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const isLoading = analyzeMutation.isPending;
  const analysisData = analysis || analyzeMutation.data?.analysis;

  if (chapters.length === 0) {
    return (
      <div className="space-y-4">
        <BlurbDrafterSection novel={novel} novelId={novelId} analysisSummary={analysisData?.summary} />
        <Card>
          <CardHeader>
            <CardTitle className="font-heading flex items-center gap-2">
              <Brain className="w-5 h-5" />
              วิเคราะห์ความต่อเนื่อง
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              ไม่มีตอนให้วิเคราะห์ กรุณาสร้างตอนก่อน
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
    <BlurbDrafterSection novel={novel} novelId={novelId} analysisSummary={analysisData?.summary} />
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="font-heading flex items-center gap-2">
            <Brain className="w-5 h-5" />
            วิเคราะห์ความต่อเนื่อง
          </CardTitle>
          <Button
            onClick={handleAnalyze}
            disabled={isLoading}
            className="gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                กำลังวิเคราะห์...
              </>
            ) : (
              <>
                <Brain className="w-4 h-4" />
                วิเคราะห์เลย
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">AI กำลังตรวจสอบความต่อเนื่องของเนื้อหา...</p>
          </div>
        )}

        <AnimatePresence>
          {analysisData && !isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              {/* Overall Score */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold ${
                        analysisData.overall_score >= 80 ? 'bg-green-100 text-green-700' :
                        analysisData.overall_score >= 60 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {analysisData.overall_score}
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">คะแนนความต่อเนื่อง</p>
                        <p className="font-semibold">
                          {analysisData.overall_score >= 80 ? 'ดีมาก' :
                           analysisData.overall_score >= 60 ? 'ปานกลาง' :
                           'ต้องปรับปรุง'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className={`w-12 h-12 ${
                        analysisData.has_issues ? 'text-red-500' : 'text-green-500'
                      }`} />
                      <div>
                        <p className="text-sm text-muted-foreground">ปัญหาที่พบ</p>
                        <p className="font-semibold text-2xl">
                          {analysisData.issues?.length || 0} ข้อ
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-12 h-12 text-green-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">ด้านที่ดี</p>
                        <p className="font-semibold text-2xl">
                          {analysisData.positive_aspects?.length || 0} ข้อ
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Summary */}
              <Alert className={analysisData.has_issues ? 'border-yellow-500 bg-yellow-50' : 'border-green-500 bg-green-50'}>
                <AlertDescription className="flex items-start gap-3">
                  {analysisData.has_issues ? (
                    <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  )}
                  <p className="text-sm">{analysisData.summary}</p>
                </AlertDescription>
              </Alert>

              {/* Issues */}
              {analysisData.issues && analysisData.issues.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    ปัญหาที่พบ
                  </h4>
                  {analysisData.issues.map((issue, idx) => {
                    const Icon = typeIcons[issue.type] || AlertTriangle;
                    const isExpanded = expandedIssues[idx];

                    return (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                      >
                        <Card className={`border-l-4 ${
                          issue.severity === 'high' ? 'border-l-red-500' :
                          issue.severity === 'medium' ? 'border-l-yellow-500' :
                          'border-l-blue-500'
                        }`}>
                          <CardHeader className="py-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3 flex-1">
                                <div className={`p-2 rounded-lg ${severityColors[issue.severity]}`}>
                                  <Icon className="w-4 h-4" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Badge className={severityColors[issue.severity]}>
                                      {issue.severity === 'high' ? 'รุนแรง' :
                                       issue.severity === 'medium' ? 'ปานกลาง' : 'เล็กน้อย'}
                                    </Badge>
                                    <Badge variant="outline">
                                      {typeLabels[issue.type]}
                                    </Badge>
                                  </div>
                                  <CardTitle className="text-base">{issue.title}</CardTitle>
                                  {issue.affected_chapters && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      ตอนที่เกี่ยวข้อง: {issue.affected_chapters.join(', ')}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleIssue(idx)}
                                className="shrink-0"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
                          </CardHeader>
                          {isExpanded && (
                            <CardContent className="space-y-3">
                              <div>
                                <p className="text-sm font-medium mb-1">รายละเอียด</p>
                                <p className="text-sm text-muted-foreground">{issue.description}</p>
                              </div>
                              {issue.suggestion && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                  <p className="text-sm font-medium text-blue-800 mb-1">
                                    💡 คำแนะนำ
                                  </p>
                                  <p className="text-sm text-blue-700">{issue.suggestion}</p>
                                </div>
                              )}
                            </CardContent>
                          )}
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* Positive Aspects */}
              {analysisData.positive_aspects && analysisData.positive_aspects.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    ด้านที่ดี
                  </h4>
                  <div className="grid gap-2">
                    {analysisData.positive_aspects.map((aspect, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">{aspect}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {analysisData.recommendations && analysisData.recommendations.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    คำแนะนำ
                  </h4>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-2">
                    {analysisData.recommendations.map((rec, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm">
                        <TrendingUp className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
                        <span className="text-purple-800">{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {!analysisData && !isLoading && (
          <div className="text-center py-8">
            <Brain className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">
              คลิก "วิเคราะห์เลย" เพื่อให้ AI ตรวจสอบความต่อเนื่องของเนื้อหา
            </p>
          </div>
        )}
      </CardContent>
    </Card>
    </div>
  );
}