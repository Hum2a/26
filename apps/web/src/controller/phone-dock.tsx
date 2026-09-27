import { createPortal } from "react-dom";
import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  type ReactElement,
  type ReactNode,
} from "react";

const DockContext = createContext<HTMLElement | null>(null);
const HoldContext = createContext(false);

export function PhoneDockTarget({
  node,
  held,
  children,
}: {
  node: HTMLElement | null;
  held: boolean;
  children: ReactNode;
}) {
  return (
    <DockContext.Provider value={node}>
      <HoldContext.Provider value={held}>{children}</HoldContext.Provider>
    </DockContext.Provider>
  );
}

export function PhoneDock({ children }: { children: ReactNode }) {
  const target = useContext(DockContext);
  const held = useContext(HoldContext);
  const content = held ? holdControls(children) : children;
  if (!target) {
    return content;
  }
  return createPortal(content, target);
}

function holdControls(children: ReactNode): ReactNode {
  return Children.map(children, (child) => {
    if (!isValidElement<{ disabled?: boolean }>(child)) {
      return child;
    }
    return cloneElement(child as ReactElement<{ disabled?: boolean }>, {
      disabled: true,
    });
  });
}
