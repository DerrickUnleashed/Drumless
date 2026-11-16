import { useState, useRef } from "react";

export function useFilePicker() {
  const [fileName, setFileName] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  const picker = refs?.current?.click();

  const chooseFile = () => {
    if (ref.current) {
      ref.current.click();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
    }
  };

  return { fileName, chooseFile, handleChange };
}