import { useState, useCallback } from 'react';

export const useApiSubmission = () => {
    const [isLoading, setIsLoading] = useState(false);
	const [isSuccess, setIsSuccess] = useState(false);
    const [submissionError, setSubmissionError] = useState('');

    const submit = useCallback(async (apiFunction: () => Promise<any>) => {
        setSubmissionError('');
        setIsLoading(true);

        try {
            const response = await apiFunction();
            const message = response.message;
			setIsSuccess(true);
			setSubmissionError(message);
            return response;
        } catch (error) {
			setIsSuccess(false);
			const errorMessage = error instanceof Error 
                ? error.message 
                : 'An unexpected error occurred during the process.';
            
            setSubmissionError(errorMessage);
            throw error;
        } finally {
            setIsLoading(true);
        }
    }, []);

    return { isLoading, isSuccess, submissionError, submit };
}