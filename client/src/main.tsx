import { createRoot } from "react-dom/client";
import { MotionConfig } from "framer-motion";
import App from "./App";
import "./index.css";
import "./styles/teacher-delivery-v3.css";
import "./styles/portal-ui-v3.css";
import "./styles/student-learning-v3.css";
import "./styles/registrar-v3.css";
import "./styles/hod-v3.css";
import "./styles/branch-v3.css";
import "./styles/admin-v3.css";
import "./styles/portal-v4.css";
import "./styles/teacher-v4.css";
import "./styles/student-v4.css";
import "./styles/operations-v4.css";
import "./styles/admin-v4.css";
import "./styles/portal-insights.css";
import "./styles/nile-forms.css";

createRoot(document.getElementById("root")!).render(
  <MotionConfig reducedMotion="user">
    <App />
  </MotionConfig>
);
