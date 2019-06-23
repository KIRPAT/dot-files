"WARNING: Go to bottom and read the NOTES. 

"-VUNDLE-----------------------------------------------------
set nocompatible              " be iMproved, required
filetype off                  " required

" set the runtime path to include Vundle and initialize
set rtp+=~/.vim/bundle/Vundle.vim
call vundle#begin()
" alternatively, pass a path where Vundle should install plugins
"call vundle#begin('~/some/path/here')

" let Vundle manage Vundle, required
Plugin 'VundleVim/Vundle.vim'
"--PLUGINS (KIRPAT's)----------------------------------------
Plugin 'scrooloose/nerdtree'		 "NERDTree
Plugin 'Valloric/YouCompleteMe'          "YouCompleteMe
Plugin 'pangloss/vim-javascript'         "vim-Javascript
Plugin 'iamcco/markdown-preview.vim'     "Markdown Preview
Plugin 'iamcco/mathjax-support-for-mkdp' "MP Math Support
Plugin 'vim-airline/vim-airline'	 "Vim Airline
Plugin 'vim-airline/vim-airline-themes'	 "Vim Airline Themes
Plugin 'maksimr/vim-jsbeautify'		 "Vim JsBeautify
Plugin 'KabbAmine/vCoolor.vim'           "vCoolor Picker   
Plugin 'skammer/vim-css-color'		 "vim-css-color
Plugin 'w0rp/ale'                        "Ale Linter
Plugin 'dart-lang/dart-vim-plugin'       "Dart Plugin
Plugin 'honza/vim-snippets'              "Snippets
Plugin 'leafOfTree/vim-vue-plugin'    	 "Vue Syntax Highlight

"NEOVIM PLUGINS
Plugin 'equalsraf/neovim-gui-shim' 
Plugin 'dzhou121/gonvim-fuzzy'
Plugin 'autozimu/LanguageClient-neovim'

"------------------------------------------------------------
" All of your Plugins must be added before the following line
call vundle#end()            " required
filetype plugin indent on    " required
" To ignore plugin indent changes, instead use:
"filetype plugin on
"
" Brief help
" :PluginList       - lists configured plugins
" :PluginInstall    - installs plugins; append `!` to update or just :PluginUpdate
" :PluginSearch foo - searches for foo; append `!` to refresh local cache
" :PluginClean      - confirms removal of unused plugins; append `!` to auto-approve removal
" see :h vundle for more details or wiki for FAQ
" Put your non-Plugin stuff after this line

"-CONFIGS (KIRPAT'S)---------------------------------------

"Aliases
nnoremap qq     :bd<cr>  
nnoremap qw     :w\|bd<cr>
nnoremap <C-s>  :w<cr>
nnoremap Q      :q!<cr> 
nnoremap çç     :bn<cr>

"Toggles
syntax on

" General
set number	   " Show line numbers
set linebreak	   " Break lines at word (requires Wrap lines)
"set showbreak=--   " Wrap-broken line prefix
set textwidth=100  " Line wrap (number of cols)
set showmatch	   " Highlight matching brace
"set spell	   " Enable spell-checking
"set visualbell	   " Use visual bell (no beeping)

"set hlsearch	   " Highlight all search results
set smartcase	   " Enable smart-case search
set ignorecase	   " Always case-insensitive
set incsearch	   " Searches for strings incrementally

set autoindent	   " Auto-indent new lines
set shiftwidth=2   " Number of auto-indent spaces
set smartindent	   " Enable smart-indent
set smarttab	   " Enable smart-tabs
set softtabstop=2  " Number of spaces per Tab

" Advanced
set ruler          " Show row and column ruler information
set undolevels=1000      	" Number of undo levels
set backspace=indent,eol,start	" Backspace behaviour

"-Plugin Configs-

"" NERDTree
map <C-n> :NERDTreeToggle<CR>
let g:NERDTreeDirArrowExpandable = '▸'
let g:NERDTreeDirArrowCollapsible = '▾'

"" vim-javascript
let g:javascript_plugin_jsdoc = 1
let g:javascript_plugin_ngdoc = 1
let g:javascript_plugin_flow = 1

"" markdown-preview
let g:mkdp_auto_start = 1 "Auto opens browser preview
let g:mkdp_auto_close = 1 "Auto closes browser preview

"" vim-airline
let g:airline#extensions#tabline#enabled = 1
let g:airline#extensions#tabline#formatter = 'unique_tail_improved'

"" js-beautifier
autocmd FileType javascript noremap <buffer>  <c-f> :call JsBeautify()<cr>
autocmd FileType json noremap <buffer> <c-f> :call JsonBeautify()<cr>
autocmd FileType jsx noremap <buffer> <c-f> :call JsxBeautify()<cr>
autocmd FileType html noremap <buffer> <c-f> :call HtmlBeautify()<cr>
autocmd FileType css noremap <buffer> <c-f> :call CSSBeautify()<cr>

"" Ale

"" vcoolor
let g:vcoolor_map = '<c-c>'

"" vim-css-color
let g:cssColorVimDoNotMessMyUpdatetime = 1

"-NOTES---------------------------------------------
" "Note_0" Vundle, and :PluginInstall
" Vundle installs plugins, but you need to install Vundle by hand.
" Run this: git clone https://github.com/VundleVim/Vundle.vim.git ~/.vim/bundle/Vundle.vim
" Then, install plugins via, :PluginInstall
"-----------------
" "Note_1" Ctrl+S Mapping
" Ctrl+S is the Scroll Lock of Unix terminal.  
" We need to disable it. 
" Include the following line into your .bashrc file: 
" stty -ixon
"------------------
" "Note_2" YouCompleteMe
" Upon :PluginInstall you will get an error, don't panic.
" There is one additional step for YouCompleteMe
" You need to run: python install.py 
" in ~/.vim/bundle/YouCompleteMe
"-----------------
" "Note_3" js-Beautify
" You need jsBeautify from npm: npm install -g js-beautify
" Run this for updating submodules:
" cd ~/.vim/bundle/vim-jsbeautify && git submodule update --init --recursive
