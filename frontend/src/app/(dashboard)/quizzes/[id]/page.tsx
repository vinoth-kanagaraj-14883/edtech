import QuizRunner from '@/components/QuizRunner';
import { getQuiz } from '@/lib/api';
import { requireServerAuth } from '@/lib/server-auth';

interface QuizPageProps {
  params: {
    id: string;
  };
}

export default async function QuizPage({ params }: QuizPageProps) {
  const { token } = requireServerAuth();

  try {
    const quiz = await getQuiz(params.id, { token });
    return <QuizRunner quiz={quiz} />;
  } catch (error) {
    return <div className="surface border border-rose-500/30 bg-rose-500/10 p-8 text-rose-100">{error instanceof Error ? error.message : 'Unable to load this quiz.'}</div>;
  }
}
