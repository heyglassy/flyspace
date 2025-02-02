import { useState } from "react";

const PromptEditor = ({
  initialPrompt,
  onSubmit,
}: {
  initialPrompt: string;
  onSubmit: (prompt: string) => void;
}) => {
  const [prompt, setPrompt] = useState(initialPrompt);

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Enter your prompt here..."
        className="w-full h-full resize-none border border-neutral-300 rounded p-2 bg-neutral-50 shadow-sm"
      />
      <button
        onClick={() => {
          onSubmit(prompt);
        }}
        className="bg-green-200 shadow-sm text-neutral-900 border border-solid border-green-600 hover:bg-green-400 px-2 py-1 rounded w-full h-fit"
      >
        Test Prompt
      </button>
    </div>
  );
};

export default PromptEditor;
