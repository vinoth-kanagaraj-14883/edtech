import { PageNotice } from '@/components/Feedback';
import QuizRunner from '@/components/QuizRunner';
import { getQuiz } from '@/lib/api';
import { requireServerAuth } from '@/lib/server-auth';

interface QuizPageProps {
  params: {
    id: string;
  };
}

export default async function QuizPage({ params }: QuizPageProps) {
  const { token, user } = requireServerAuth();

  try {
    const quiz = await getQuiz(params.id, { token });
    return <QuizRunner quiz={quiz} userId={user.id} />;
  } catch (error) {
    return (
      <PageNotice title="Unable to load this quiz">
        <p>{error instanceof Error ? error.message : 'Unable to load this quiz.'}</p>
      </PageNotice>
    );
  }
}
