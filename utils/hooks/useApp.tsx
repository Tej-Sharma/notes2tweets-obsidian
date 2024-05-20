import { App } from "obsidian";
import { useContext } from "react";
import { AppContext } from "utils/contexts/AppContext";

export const useApp = (): App | undefined => {
  return useContext(AppContext);
};