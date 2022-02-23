use std::iter::{Iterator, Peekable};
use std::str::Chars;
use thiserror::Error;
use wasm_bindgen::prelude::*;

#[derive(Error, Debug, Copy, Clone)]
enum SyntaxError {
    #[error("invalid ending: \\")]
    InvalidEnding,
    #[error("unclosed quote")]
    UnclosedQuote,
    #[error("unclosed parenthesis")]
    UnclosedParenthesis,
    #[error("invalid token: {0}")]
    InvalidToken(char),
    #[error("invalid syntax")]
    InvalidSyntax,
}

struct Stream<'a> {
    stream: Peekable<Chars<'a>>,
    single_char_token: bool,
}

#[derive(Copy, Clone)]
enum Oprt {
    LeftParenthesis,
    RightParenthesis,
    Concatenate,
    Or,
    ZeroOrMore,
    OneOrMore,
}

enum Token {
    Oprt(Oprt),
    Symbol(String),
}

impl<'a> Iterator for Stream<'a> {
    type Item = Result<Token, SyntaxError>;

    fn next(&mut self) -> Option<Self::Item> {
        let is_symbol = |c: char| c.is_alphanumeric() || c == '_' || c == '-';
        match self.stream.next() {
            Some('(') => Some(Ok(Token::Oprt(Oprt::LeftParenthesis))),
            Some(')') => Some(Ok(Token::Oprt(Oprt::RightParenthesis))),
            Some('.') => Some(Ok(Token::Oprt(Oprt::Concatenate))),
            Some('+') => Some(Ok(Token::Oprt(Oprt::OneOrMore))),
            Some('*') => Some(Ok(Token::Oprt(Oprt::ZeroOrMore))),
            Some('|') => Some(Ok(Token::Oprt(Oprt::Or))),
            Some(quote @ ('\'' | '"')) => {
                let mut sym = String::new();
                loop {
                    match self.stream.next() {
                        Some(c @ ('\'' | '"')) if c == quote => {
                            return Some(Ok(Token::Symbol(sym)))
                        }
                        Some('\\') => match self.stream.next() {
                            Some(c) => sym.push(c),
                            None => return Some(Err(SyntaxError::InvalidEnding)),
                        },
                        Some(c) => sym.push(c),
                        None => return Some(Err(SyntaxError::UnclosedQuote)),
                    }
                }
            }
            Some(c) if c.is_whitespace() => self.next(),
            Some(c) if !is_symbol(c) => Some(Err(SyntaxError::InvalidToken(c))),
            Some(c) => {
                if self.single_char_token {
                    Some(Ok(Token::Symbol(String::from(c))))
                } else {
                    let mut sym = String::from(c);
                    while let Some(c) = self.stream.next_if(|&c| is_symbol(c)) {
                        sym.push(c);
                    }
                    Some(Ok(Token::Symbol(sym)))
                }
            }
            None => None,
        }
    }
}

#[derive(Clone)]
pub enum Inner {
    Symbol(String),
    Concatenate(AST, AST),
    Or(AST, AST),
    ZeroOrMore(AST),
    OneOrMore(AST),
}

#[wasm_bindgen]
#[derive(Clone)]
pub struct AST(Box<Inner>);

impl AST {
    pub fn new(inner: Inner) -> AST {
        AST(Box::new(inner))
    }

    pub fn into_inner(self) -> Inner {
        *self.0
    }
}

#[wasm_bindgen]
pub struct Parser {
    symbols: Vec<AST>,
    oprts: Vec<Oprt>,
}

#[wasm_bindgen]
impl Parser {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Parser {
        Parser {
            symbols: Vec::new(),
            oprts: Vec::new(),
        }
    }

    pub fn parse(mut self, re: &str, single_char_token: bool) -> Result<AST, JsError> {
        let re = re.trim();
        if re.is_empty() {
            return Ok(AST::new(Inner::Symbol("".into())));
        }
        let tokens = Stream {
            stream: re.chars().peekable(),
            single_char_token,
        };
        let mut eos = false;
        for token in tokens {
            eos = match token? {
                Token::Symbol(sym) => {
                    if eos {
                        self.oprts.push(Oprt::Concatenate);
                    }
                    self.symbols.push(AST::new(Inner::Symbol(sym)));
                    true
                }
                Token::Oprt(oprt) => match oprt {
                    Oprt::LeftParenthesis => {
                        if eos {
                            self.oprts.push(Oprt::Concatenate);
                        }
                        self.oprts.push(oprt);
                        false
                    }
                    Oprt::RightParenthesis => loop {
                        match self.oprts.pop() {
                            Some(Oprt::LeftParenthesis) => break true,
                            Some(oprt) => self.take(oprt)?,
                            None => return Err(SyntaxError::InvalidSyntax.into()),
                        }
                    },
                    Oprt::ZeroOrMore | Oprt::OneOrMore => {
                        self.take(oprt)?;
                        true
                    }
                    Oprt::Concatenate | Oprt::Or => {
                        loop {
                            match self.oprts.pop() {
                                Some(oprt @ (Oprt::Concatenate | Oprt::Or)) => self.take(oprt)?,
                                Some(oprt) => {
                                    self.oprts.push(oprt);
                                    break;
                                }
                                None => break,
                            }
                        }
                        self.oprts.push(oprt);
                        false
                    }
                },
            };
        }

        while let Some(oprt) = self.oprts.pop() {
            self.take(oprt)?;
        }
        return match self.symbols.pop() {
            Some(sym) if self.symbols.is_empty() => Ok(sym),
            _ => Err(SyntaxError::InvalidSyntax.into()),
        };
    }

    fn take(&mut self, oprt: Oprt) -> Result<(), SyntaxError> {
        match oprt {
            Oprt::Concatenate => {
                let rhs = self.symbols.pop().ok_or(SyntaxError::InvalidSyntax)?;
                let lhs = self.symbols.pop().ok_or(SyntaxError::InvalidSyntax)?;
                self.symbols.push(AST::new(Inner::Concatenate(lhs, rhs)));
            }
            Oprt::Or => {
                let rhs = self.symbols.pop().ok_or(SyntaxError::InvalidSyntax)?;
                let lhs = self.symbols.pop().ok_or(SyntaxError::InvalidSyntax)?;
                self.symbols.push(AST::new(Inner::Or(lhs, rhs)));
            }
            Oprt::ZeroOrMore => {
                let oprn = self.symbols.pop().ok_or(SyntaxError::InvalidSyntax)?;
                self.symbols.push(AST::new(Inner::ZeroOrMore(oprn)));
            }
            Oprt::OneOrMore => {
                let oprn = self.symbols.pop().ok_or(SyntaxError::InvalidSyntax)?;
                self.symbols.push(AST::new(Inner::OneOrMore(oprn)));
            }
            _ => return Err(SyntaxError::UnclosedParenthesis),
        }
        Ok(())
    }
}
