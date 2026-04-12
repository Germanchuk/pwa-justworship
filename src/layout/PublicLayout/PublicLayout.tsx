import {Outlet} from "react-router-dom";
import {Container} from "#components";

const PublicLayout = () => {
  return (
    <Container>
      <Outlet />
    </Container>
  )
}

export default PublicLayout;