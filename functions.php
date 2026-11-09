<?php
if (!defined('ABSPATH')) exit;

define('MIZAN_VER', '1.0.0');

// Keep the front end lean.
remove_action('wp_head', 'print_emoji_detection_script', 7);
remove_action('wp_print_styles', 'print_emoji_styles');
remove_action('wp_head', 'wp_generator');
add_action('wp_enqueue_scripts', function () {
    wp_dequeue_style('wp-block-library');
    wp_dequeue_style('global-styles');
    wp_dequeue_style('classic-theme-styles');
}, 100);

add_action('after_setup_theme', function () {
    add_theme_support('title-tag');
});
// The landing template prints its own <title>.
add_filter('pre_get_document_title', function ($t) { return is_front_page() ? '' : $t; });
add_action('wp', function () { if (is_front_page()) remove_action('wp_head', '_wp_render_title_tag', 1); });

// Beta signups: stored privately, listed under "Beta signups" in wp-admin.
add_action('init', function () {
    register_post_type('mizan_beta', array(
        'labels' => array('name' => 'Beta signups', 'singular_name' => 'Beta signup', 'menu_name' => 'Beta signups'),
        'public' => false, 'show_ui' => true, 'show_in_menu' => true, 'menu_icon' => 'dashicons-email-alt',
        'supports' => array('title'), 'capability_type' => 'post',
        'capabilities' => array('create_posts' => 'do_not_allow'), 'map_meta_cap' => true,
    ));
});

add_filter('manage_mizan_beta_posts_columns', function ($c) {
    return array('cb' => $c['cb'], 'title' => 'Email', 'date' => 'Signed up');
});

function mizan_beta_handler() {
    if (!empty($_POST['website'])) wp_send_json_success(); // honeypot: quietly accept bots
    $email = sanitize_email(wp_unslash($_POST['email'] ?? ''));
    if (!is_email($email)) wp_send_json_error('Enter a valid email address, like you@example.com.', 400);

    $ip = sanitize_text_field($_SERVER['REMOTE_ADDR'] ?? '');
    $key = 'mizan_beta_' . md5($ip);
    $n = (int) get_transient($key);
    if ($n >= 5) wp_send_json_error('Too many tries. Please wait a few minutes.', 429);
    set_transient($key, $n + 1, 10 * MINUTE_IN_SECONDS);

    $email = strtolower($email);
    $exists = get_posts(array('post_type' => 'mizan_beta', 'title' => $email, 'post_status' => 'any', 'fields' => 'ids', 'numberposts' => 1));
    if (!$exists) {
        wp_insert_post(array('post_type' => 'mizan_beta', 'post_title' => $email, 'post_status' => 'publish'));
        wp_mail(get_option('admin_email'), 'New Mizan beta signup', $email . " joined the hosted beta list.\n\nAll signups: " . admin_url('edit.php?post_type=mizan_beta'));
    }
    wp_send_json_success();
}
add_action('wp_ajax_mizan_beta', 'mizan_beta_handler');
add_action('wp_ajax_nopriv_mizan_beta', 'mizan_beta_handler');

function mizan_render_landing() {
    $html = file_get_contents(get_template_directory() . '/landing.html');
    ob_start(); wp_head(); $head = ob_get_clean();
    ob_start(); wp_footer(); $foot = ob_get_clean();
    echo strtr($html, array(
        '%%ASSETS%%'   => esc_url(get_template_directory_uri() . '/assets'),
        '%%VER%%'      => MIZAN_VER,
        '%%ENDPOINT%%' => esc_url(admin_url('admin-ajax.php')),
        '%%NONCE%%'    => '',
        '%%YEAR%%'     => gmdate('Y'),
        '%%HEAD%%'     => $head,
        '%%FOOT%%'     => $foot,
    ));
}
