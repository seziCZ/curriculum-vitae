domain      = "sezima.dev"
alert_email = "sezimatomas@gmail.com"

# tomas@sezima.dev forwards to Gmail through Forward Email (free plan, DNS records only).
mail_forwarding = { tomas = "sezimatomas@gmail.com" }

# Ownership proofs for search engines. They are public in DNS anyway, so they are not secret.
verification_txt = ["google-site-verification=tjcfdZt2zjJBgPbgFu4M7AFGr7GMRmnKSv0TeMC_BiI"]
