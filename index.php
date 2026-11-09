<?php
if (!defined("ABSPATH")) exit;
if (is_404()) { wp_safe_redirect(home_url("/"), 302); exit; }
mizan_render_landing();
