import SignInForm from "@/components/auth/SignInForm";
import PageMeta from "@/components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";

export default function SignIn() {
  return (
    <>
      <PageMeta
        title="Sign in | CGSI Cube"
        description="Sign in to CGSI Cube with your organization Microsoft account."
      />
      <AuthLayout>
        <SignInForm />
      </AuthLayout>
    </>
  );
}
