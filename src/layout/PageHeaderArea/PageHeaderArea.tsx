import {Container} from "#components";
import {usePageHeader} from "#layout/PageHeaderArea/hooks";


export const PageHeaderArea = () => {
  const { header } = usePageHeader();
  // <div className="sticky top-0 glass z-30">
  return (
    <div className={"shrink-0 glass border-x-0 border-t-0"}>
      <Container>
        {header}
      </Container>
    </div>
  );
};
