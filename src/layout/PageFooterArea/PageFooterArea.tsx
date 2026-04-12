import {usePageFooter} from "#layout/PageFooterArea/hooks";


export const PageFooterArea = () => {
  const { footer } = usePageFooter();
  // <div className="sticky top-0 glass z-30">
  return footer;
};
