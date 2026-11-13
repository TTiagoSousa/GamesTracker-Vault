import { useState } from "react";
import { End_Points } from "../../Service/endPoints";
import http from "../../Service/httpService";
import { useAlert } from "../../Contexts/Alert_Context";
import i18n from "../../i18n";
import { errorMessage } from "../System/types";

export const useSignin = () => {
  const [signInEmail, setSignInEmail] = useState('');
  const [signInpassword, setSignInpassword] = useState('');
  const [loading, setLoading] = useState(false);

  const { setAlert } = useAlert();

  const signin = async () => {

    if (!signInEmail || !signInpassword) {
      return setAlert({
        open: true,
        message: i18n.t('auth:login.alerts.missingFields'),
        type: 'error'
      });
    }

    setLoading(true);

    try {

      await http.post(
        End_Points.Sign_In_Endpoint(),
        { username: signInEmail, password: signInpassword },
        { withCredentials: true }
      );

      setAlert({
        open: true,
        message: i18n.t('auth:login.alerts.success'),
        type: 'success',
      });

      setTimeout(() => {
        window.location.href = '/Vault';
      }, 300);

    } catch (error) {

      const msg = errorMessage(error);

      setAlert({
        open: true,
        message: msg,
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    signInEmail,
    setSignInEmail,
    signInpassword,
    setSignInpassword,
    signin,
    loading,
  };
};